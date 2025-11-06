import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, getISOWeek, getYear } from 'date-fns';
import { Loader2, Dumbbell, ChevronLeft, ChevronRight, Info } from 'lucide-react';

const Gym = () => {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
  const weekStart = format(selectedWeek, 'MMM d');
  const weekEnd = format(addDays(selectedWeek, 6), 'MMM d, yyyy');

  // Fetch gym slots
  const { data: slots, isLoading } = useQuery({
    queryKey: ['gymSlots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('resource_type', 'GYM')
        .eq('is_active', true)
        .order('start_time');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings
  const { data: bookings } = useQuery({
    queryKey: ['gymBookings', selectedWeek],
    queryFn: async () => {
      const dateStart = format(selectedWeek, 'yyyy-MM-dd');
      const dateEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
      
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

  // Check user's active gym bookings
  const { data: activeBookings } = useQuery({
    queryKey: ['activeGymBookings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('resource_type', 'GYM')
        .eq('status', 'booked')
        .gte('booking_date', today);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create booking
  const createBooking = useMutation({
    mutationFn: async ({ slotId, date }: { slotId: string; date: Date }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check if user already has an active future booking
      if (activeBookings && activeBookings.length >= 1) {
        throw new Error('You can only have 1 active gym booking at a time. Cancel your existing booking first.');
      }
      
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
      queryClient.invalidateQueries({ queryKey: ['activeGymBookings'] });
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
      queryClient.invalidateQueries({ queryKey: ['activeGymBookings'] });
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date, slot: any) => {
    const now = new Date();
    const slotDateTime = new Date(date);
    const [hours, minutes] = slot.end_time.split(':');
    slotDateTime.setHours(parseInt(hours), parseInt(minutes));
    return slotDateTime < now;
  };

  const canBook = () => {
    return !activeBookings || activeBookings.length < 1;
  };

  // Group slots by time
  const uniqueTimes = Array.from(new Set(slots?.map(s => `${s.start_time}-${s.end_time}`))).sort();

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

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="text-center">
            <p className="font-medium">Week of {weekStart} – {weekEnd}</p>
            <p className="text-sm text-muted-foreground">Week {getISOWeek(selectedWeek)}, {getYear(selectedWeek)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Active Bookings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Active Bookings
              <Badge variant={canBook() ? 'default' : 'destructive'}>
                {activeBookings?.length || 0}/1
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>You can have 1 active gym booking at a time. Cancel your existing booking to book a new slot.</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[800px] border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium sticky left-0 bg-muted/50">Time (90 min)</th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="p-3 text-center font-medium min-w-[120px]">
                          <div className={isToday(day) ? 'text-primary font-bold' : ''}>{format(day, 'EEE')}</div>
                          <div className={`text-sm ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                            {format(day, 'MMM d')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTimes.map(timeRange => {
                      const [startTime, endTime] = timeRange.split('-');
                      
                      return (
                        <tr key={timeRange} className="border-t">
                          <td className="p-3 font-medium sticky left-0 bg-background">
                            <div className="text-sm">{startTime}</div>
                            <div className="text-xs text-muted-foreground">{endTime}</div>
                          </td>
                          {weekDays.map(day => {
                            const dayOfWeek = day.getDay();
                            const slot = slots?.find(
                              s => s.day_of_week === dayOfWeek && 
                                   s.start_time === startTime && 
                                   s.end_time === endTime
                            );
                            
                            if (!slot) {
                              return <td key={day.toISOString()} className="p-3 bg-muted/20"></td>;
                            }
                            
                            const slotBookings = getBookingsForSlot(slot.id, day);
                            const capacity = 6; // Default gym capacity
                            const isFull = slotBookings.length >= capacity;
                            const userHasBooked = hasUserBooked(slot.id, day);
                            const userBooking = slotBookings.find(b => b.user_id === user?.id);
                            const isSlotPast = isPast(day, slot);

                            return (
                              <td key={day.toISOString()} className="p-3">
                                {userHasBooked ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="w-full bg-primary hover:bg-primary/90"
                                    onClick={() => userBooking && cancelBooking.mutate(userBooking.id)}
                                    disabled={cancelBooking.isPending || isSlotPast}
                                  >
                                    {isSlotPast ? 'Past' : 'Cancel'}
                                  </Button>
                                ) : isSlotPast ? (
                                  <Badge variant="outline" className="w-full justify-center text-xs">
                                    Past
                                  </Badge>
                                ) : isFull ? (
                                  <Badge variant="secondary" className="w-full justify-center">
                                    Full
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full hover:bg-primary/10 hover:text-primary hover:border-primary"
                                    onClick={() => createBooking.mutate({ slotId: slot.id, date: day })}
                                    disabled={!canBook() || createBooking.isPending}
                                  >
                                    Book ({slotBookings.length}/{capacity})
                                  </Button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-primary bg-primary/10"></div>
                    <span>Your booking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border bg-background"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-secondary"></div>
                    <span>Full</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border bg-muted"></div>
                    <span>Past / Closed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Gym;
