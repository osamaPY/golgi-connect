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
import { dailySlots90EndAt23, isSlotPast } from '@/lib/slots';

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
        .select('*')
        .eq('resource_type', 'GYM')
        .eq('status', 'booked')
        .gte('booking_date', dateStart)
        .lte('booking_date', dateEnd);
      
      if (error) throw error;
      return data;
    },
  });

  // ✅ Check user's gym bookings for the week (up to 4 allowed)
  const { data: weeklyBookings } = useQuery({
    queryKey: ['weeklyGymBookings', user?.id, selectedWeek],
    queryFn: async () => {
      if (!user) return [];
      
      const weekStart = format(selectedWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('resource_type', 'GYM')
        .eq('status', 'booked')
        .gte('booking_date', weekStart)
        .lte('booking_date', weekEnd);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ✅ Create gym booking mutation - IDEMPOTENT DESIGN
  // Enforces maximum 4 gym bookings per ISO week per user
  // Handles duplicate bookings gracefully (idempotent)
  const createBooking = useMutation({
    mutationFn: async ({ slotId, date }: { slotId: string; date: Date }) => {
      if (!user) throw new Error('Not authenticated');
      
      // ✅ Enforce gym rule: max 4 bookings per ISO week
      if (weeklyBookings && weeklyBookings.length >= 4) {
        throw new Error('You can only have 4 gym bookings per week. Cancel an existing booking first.');
      }
      
      const bookingDate = format(date, 'yyyy-MM-dd');
      
      // ✅ Check if user already has this exact booking
      const { data: existing } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('slot_id', slotId)
        .eq('booking_date', bookingDate)
        .eq('resource_type', 'GYM')
        .eq('status', 'booked')
        .maybeSingle();
      
      // ✅ IDEMPOTENT: If already booked, return existing (no error)
      if (existing) {
        return existing;
      }
      
      // ✅ Try to insert new booking (units always 1 for GYM)
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          slot_id: slotId,
          booking_date: bookingDate,
          resource_type: 'GYM',
          units: 1,
          status: 'booked',
        })
        .select()
        .single();
      
      // ✅ Handle duplicate key error gracefully (race condition)
      if (error) {
        if (error.code === '23505') {
          // Race condition - fetch the booking that was just created
          const { data: raceData } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', user.id)
            .eq('slot_id', slotId)
            .eq('booking_date', bookingDate)
            .eq('resource_type', 'GYM')
            .eq('status', 'booked')
            .single();
          
          if (raceData) return raceData;
        }
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success(t('gym.bookingSuccess'));
      // ✅ Invalidate ALL gym queries to refresh counters and availability
      queryClient.invalidateQueries({ queryKey: ['gymBookings'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGymBookings'] });
      queryClient.invalidateQueries({ queryKey: ['gymSlots'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('gym.bookingError'));
    },
  });

  // ✅ Cancel gym booking mutation
  // Allows users to undo their gym bookings and free up their slot
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', 
          cancelled_by: user?.id, 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('gym.cancelSuccess'));
      // ✅ Invalidate ALL gym queries to update counters and free the slot
      queryClient.invalidateQueries({ queryKey: ['gymBookings'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGymBookings'] });
      queryClient.invalidateQueries({ queryKey: ['gymSlots'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('gym.cancelError'));
    },
  });

  // ✅ Helper: Get all bookings for a specific gym slot and date
  const getBookingsForSlot = (slotId: string, date: Date) => {
    if (!bookings) return [];
    return bookings.filter(
      b => b.slot_id === slotId && b.booking_date === format(date, 'yyyy-MM-dd')
    );
  };

  // ✅ Helper: Check if current user has booked this gym slot
  const hasUserBooked = (slotId: string, date: Date) => {
    return getBookingsForSlot(slotId, date).some(b => b.user_id === user?.id);
  };

  // ✅ Helper: Check if date is today (for highlighting)
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // ✅ Helper: Check if user can book (must have < 4 bookings this week)
  const canBook = () => {
    return !weeklyBookings || weeklyBookings.length < 4;
  };

  // ✅ Use centralized slot schedule (10 slots, 90 min each, ending at 23:00)
  const timeSlots = dailySlots90EndAt23();

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

        {/* Weekly Bookings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Weekly Bookings
              <Badge variant={canBook() ? 'default' : 'destructive'}>
                {weeklyBookings?.length || 0}/4
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>You can have up to 4 gym bookings per week. Cancel a booking to make a new reservation.</span>
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
                      <th className="p-3 text-left font-medium sticky left-0 bg-muted/50 min-w-[100px]">
                        <div className="font-semibold">Time</div>
                        <div className="text-xs text-muted-foreground font-normal">(90 min)</div>
                      </th>
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
                    {timeSlots.map(timeSlot => {
                      return (
                        <tr key={timeSlot.id} className="border-t">
                          <td className="p-3 font-medium sticky left-0 bg-background">
                            <div className="text-sm font-bold leading-tight">{timeSlot.start}</div>
                            <div className="text-xs text-muted-foreground leading-tight">{timeSlot.end}</div>
                          </td>
                          {weekDays.map(day => {
                            const dayOfWeek = day.getDay();
                            const slot = slots?.find(
                              s => s.day_of_week === dayOfWeek && 
                                   s.start_time === timeSlot.start && 
                                   s.end_time === timeSlot.end
                            );
                            
                            if (!slot) {
                              return <td key={day.toISOString()} className="p-3 bg-muted/20"></td>;
                            }
                            
                            const slotBookings = getBookingsForSlot(slot.id, day);
                            const capacity = 6; // Default gym capacity
                            const isFull = slotBookings.length >= capacity;
                            const userHasBooked = hasUserBooked(slot.id, day);
                            const userBooking = slotBookings.find(b => b.user_id === user?.id);
                            const slotIsPast = isSlotPast(day, timeSlot.end);

                            return (
                              <td key={day.toISOString()} className="p-3">
                                {userHasBooked ? (
                                  // ✅ USER'S BOOKING - Show "Cancel (You)" button with amber background
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900 font-medium"
                                    onClick={() => userBooking && cancelBooking.mutate(userBooking.id)}
                                    disabled={cancelBooking.isPending || slotIsPast}
                                  >
                                    {slotIsPast ? 'Past' : (
                                      <span className="flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-amber-600"></span>
                                        Cancel (You)
                                      </span>
                                    )}
                                  </Button>
                                ) : slotIsPast ? (
                                  // ✅ PAST SLOT - Gray disabled badge
                                  <Badge variant="outline" className="w-full justify-center text-xs bg-gray-100 text-gray-500">
                                    Past
                                  </Badge>
                                ) : isFull ? (
                                  // ✅ FULL SLOT - Red disabled badge
                                  <Badge variant="secondary" className="w-full justify-center bg-red-100 text-red-700 border-red-200">
                                    Full ({capacity}/{capacity})
                                  </Badge>
                                ) : (
                                  // ✅ AVAILABLE SLOT - Green "Book" button with live counter
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full bg-green-100 hover:bg-green-200 border-green-300 text-green-900"
                                    onClick={() => createBooking.mutate({ slotId: slot.id, date: day })}
                                    disabled={!canBook() || createBooking.isPending}
                                  >
                                    {createBooking.isPending ? (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Booking...
                                      </span>
                                    ) : (
                                      `Book (${slotBookings.length}/${capacity})`
                                    )}
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

            {/* Legend with color-coded examples */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-8 rounded border border-amber-300 bg-amber-100 flex items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-amber-600"></span>
                    </div>
                    <span className="font-medium">Your booking (click to cancel)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-8 rounded border border-green-300 bg-green-100"></div>
                    <span>Available (click to book)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-8 rounded border border-red-200 bg-red-100"></div>
                    <span>Full</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-8 rounded border border-gray-200 bg-gray-100"></div>
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
