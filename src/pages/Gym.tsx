import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays, startOfDay } from 'date-fns';
import { Loader2, Dumbbell } from 'lucide-react';

const Gym = () => {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

  const dates = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));

  // Fetch gym slots
  const { data: slots, isLoading } = useQuery({
    queryKey: ['gymSlots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('resource_type', 'GYM')
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings
  const { data: bookings } = useQuery({
    queryKey: ['gymBookings', selectedDate],
    queryFn: async () => {
      const dateStart = format(selectedDate, 'yyyy-MM-dd');
      const dateEnd = format(addDays(selectedDate, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(room_number, first_name)')
        .eq('resource_type', 'GYM')
        .eq('status', 'booked')
        .gte('booking_date', dateStart)
        .lte('booking_date', dateEnd);
      
      if (error) throw error;
      return data;
    },
  });

  // Create booking
  const createBooking = useMutation({
    mutationFn: async ({ slotId, date }: { slotId: string; date: Date }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          slot_id: slotId,
          booking_date: format(date, 'yyyy-MM-dd'),
          resource_type: 'GYM',
          status: 'booked',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t('gym.bookingSuccess'));
      queryClient.invalidateQueries({ queryKey: ['gymBookings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('gym.bookingError'));
    },
  });

  // Cancel booking
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_by: user?.id, cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('gym.cancelSuccess'));
      queryClient.invalidateQueries({ queryKey: ['gymBookings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('gym.cancelError'));
    },
  });

  const getBookingsForSlot = (slotId: string, date: Date) => {
    if (!bookings) return [];
    return bookings.filter(
      b => b.slot_id === slotId && b.booking_date === format(date, 'yyyy-MM-dd')
    );
  };

  const hasUserBooked = (slotId: string, date: Date) => {
    return getBookingsForSlot(slotId, date).some(b => b.user_id === user?.id);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Dumbbell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.gym')}</h1>
            <p className="text-muted-foreground">{t('gym.description')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">Time</th>
                  {dates.map(date => (
                    <th key={date.toISOString()} className="p-3 text-center font-medium">
                      <div>{format(date, 'EEE')}</div>
                      <div className="text-sm text-muted-foreground">{format(date, 'MMM d')}</div>
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
                    {dates.map(date => {
                      if (date.getDay() !== (slot.day_of_week === 0 ? 0 : slot.day_of_week)) {
                        return <td key={date.toISOString()} className="p-3"></td>;
                      }
                      
                      const slotBookings = getBookingsForSlot(slot.id, date);
                      const capacity = 6; // Default gym capacity
                      const isFull = slotBookings.length >= capacity;
                      const userHasBooked = hasUserBooked(slot.id, date);
                      const userBooking = slotBookings.find(b => b.user_id === user?.id);

                      return (
                        <td key={date.toISOString()} className="p-3">
                          {userHasBooked ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() => userBooking && cancelBooking.mutate(userBooking.id)}
                              disabled={cancelBooking.isPending}
                            >
                              {t('gym.cancel')}
                            </Button>
                          ) : isFull ? (
                            <Badge variant="secondary" className="w-full justify-center">
                              {t('gym.full')}
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => createBooking.mutate({ slotId: slot.id, date })}
                              disabled={createBooking.isPending}
                            >
                              {t('gym.book')} ({slotBookings.length}/{capacity})
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
      </div>
    </Layout>
  );
};

export default Gym;
