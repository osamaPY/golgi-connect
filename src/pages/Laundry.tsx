import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, getISOWeek, getYear } from 'date-fns';
import { Loader2, Droplet, Wind } from 'lucide-react';

const Laundry = () => {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedResource, setSelectedResource] = useState<'LAV' | 'ASC'>('LAV');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));

  // Fetch slots
  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', selectedResource],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('resource_type', selectedResource)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings for the week
  const { data: bookings } = useQuery({
    queryKey: ['bookings', selectedWeek, selectedResource],
    queryFn: async () => {
      const weekStart = format(selectedWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(room_number, first_name)')
        .eq('resource_type', selectedResource)
        .eq('status', 'booked')
        .gte('booking_date', weekStart)
        .lte('booking_date', weekEnd);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's weekly quota
  const { data: quota } = useQuery({
    queryKey: ['quota', user?.id, selectedWeek],
    queryFn: async () => {
      if (!user) return null;
      const week = getISOWeek(selectedWeek);
      const year = getYear(selectedWeek);
      
      const { data, error } = await supabase
        .from('weekly_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_number', week)
        .eq('year', year)
        .maybeSingle();
      
      if (error) throw error;
      return data || { lav_count: 0, asc_count: 0 };
    },
    enabled: !!user,
  });

  // Create booking mutation
  const createBooking = useMutation({
    mutationFn: async ({ slotId, date }: { slotId: string; date: Date }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          slot_id: slotId,
          booking_date: format(date, 'yyyy-MM-dd'),
          resource_type: selectedResource,
          status: 'booked',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t('laundry.bookingSuccess'));
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('laundry.bookingError'));
    },
  });

  // Cancel booking mutation
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_by: user?.id, cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('laundry.cancelSuccess'));
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('laundry.cancelError'));
    },
  });

  const getBookingsForSlot = (slotId: string, date: Date) => {
    if (!bookings) return [];
    return bookings.filter(
      b => b.slot_id === slotId && b.booking_date === format(date, 'yyyy-MM-dd')
    );
  };

  const canBook = () => {
    if (!quota) return false;
    if (selectedResource === 'LAV') return quota.lav_count < 3;
    if (selectedResource === 'ASC') return quota.asc_count < 2;
    return false;
  };

  const hasUserBooked = (slotId: string, date: Date) => {
    return getBookingsForSlot(slotId, date).some(b => b.user_id === user?.id);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.laundry')}</h1>
          <p className="text-muted-foreground">{t('laundry.description')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('laundry.weeklyQuota')}</CardTitle>
            <CardDescription>
              {selectedResource === 'LAV' 
                ? `${quota?.lav_count || 0} / 3 ${t('laundry.washers')}` 
                : `${quota?.asc_count || 0} / 2 ${t('laundry.dryers')}`}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={selectedResource} onValueChange={(v) => setSelectedResource(v as 'LAV' | 'ASC')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="LAV" className="flex items-center gap-2">
              <Droplet className="h-4 w-4" />
              {t('laundry.washers')} (LAV)
            </TabsTrigger>
            <TabsTrigger value="ASC" className="flex items-center gap-2">
              <Wind className="h-4 w-4" />
              {t('laundry.dryers')} (ASC)
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedResource} className="space-y-4">
            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3 text-left font-medium">Time</th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="p-3 text-center font-medium">
                          <div>{format(day, 'EEE')}</div>
                          <div className="text-sm text-muted-foreground">{format(day, 'MMM d')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots?.map(slot => (
                      <tr key={slot.id} className="border-b">
                        <td className="p-3 font-medium">
                          {slot.start_time} - {slot.end_time}
                        </td>
                        {weekDays.map(day => {
                          if (day.getDay() !== (slot.day_of_week === 0 ? 0 : slot.day_of_week)) {
                            return <td key={day.toISOString()} className="p-3"></td>;
                          }
                          
                          const slotBookings = getBookingsForSlot(slot.id, day);
                          const capacity = slot.capacity || (selectedResource === 'LAV' ? 2 : 1);
                          const isFull = slotBookings.length >= capacity;
                          const userHasBooked = hasUserBooked(slot.id, day);
                          const userBooking = slotBookings.find(b => b.user_id === user?.id);

                          return (
                            <td key={day.toISOString()} className="p-3">
                              {userHasBooked ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => userBooking && cancelBooking.mutate(userBooking.id)}
                                  disabled={cancelBooking.isPending}
                                >
                                  {t('laundry.cancel')}
                                </Button>
                              ) : isFull ? (
                                <Badge variant="secondary" className="w-full justify-center">
                                  {t('laundry.full')}
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => createBooking.mutate({ slotId: slot.id, date: day })}
                                  disabled={!canBook() || createBooking.isPending}
                                >
                                  {t('laundry.book')} ({slotBookings.length}/{capacity})
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Laundry;
