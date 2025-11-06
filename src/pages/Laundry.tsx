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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, getISOWeek, getYear } from 'date-fns';
import { Loader2, Droplet, Wind, ChevronLeft, ChevronRight, Info, ChevronDown } from 'lucide-react';
import { dailySlots90EndAt23, isSlotPast } from '@/lib/slots';

const Laundry = () => {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedResource, setSelectedResource] = useState<'LAV' | 'ASC'>('LAV');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
  const weekStart = format(selectedWeek, 'MMM d');
  const weekEnd = format(addDays(selectedWeek, 6), 'MMM d, yyyy');

  // Fetch slots
  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', selectedResource],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('resource_type', selectedResource)
        .eq('is_active', true)
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
        .select('*')
        .eq('resource_type', selectedResource)
        .eq('status', 'booked')
        .gte('booking_date', weekStart)
        .lte('booking_date', weekEnd);
      
      if (error) throw error;
      return data;
    },
  });

  // ✅ Fetch user's weekly bookings to calculate total units used
  // LAV bookings can use 1 or 2 units (washers)
  const { data: weeklyBookings } = useQuery({
    queryKey: ['weeklyBookings', user?.id, selectedWeek, selectedResource],
    queryFn: async () => {
      if (!user) return [];
      const weekStart = format(selectedWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('resource_type', selectedResource)
        .eq('status', 'booked')
        .gte('booking_date', weekStart)
        .lte('booking_date', weekEnd);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ✅ Calculate total units used this week (LAV counts units, ASC counts bookings)
  const weeklyUnitsUsed = weeklyBookings?.reduce((sum, b) => sum + (b.units || 1), 0) || 0;

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

  // ✅ Create booking mutation - IDEMPOTENT DESIGN with units support
  // LAV can book 1 or 2 washers, ASC always 1 dryer
  // Weekly quota: LAV ≤ 3 units, ASC ≤ 2 bookings
  const createBooking = useMutation({
    mutationFn: async ({ slotId, date, units = 1 }: { slotId: string; date: Date; units?: number }) => {
      if (!user) throw new Error('Not authenticated');
      
      // ✅ Check weekly quota before booking
      // LAV: max 3 units/week (booking both washers counts as 2)
      // ASC: max 2 bookings/week
      const maxQuota = selectedResource === 'LAV' ? 3 : 2;
      
      if (weeklyUnitsUsed + units > maxQuota) {
        const label = selectedResource === 'LAV' ? 'washer units' : 'dryer bookings';
        throw new Error(`Weekly quota exceeded: max ${maxQuota} ${label} per week`);
      }
      
      const bookingDate = format(date, 'yyyy-MM-dd');
      
      // ✅ First check if user already has this booking
      const { data: existing } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('slot_id', slotId)
        .eq('booking_date', bookingDate)
        .eq('resource_type', selectedResource)
        .eq('status', 'booked')
        .maybeSingle();
      
      // ✅ IDEMPOTENT: If already booked, return existing (no error)
      if (existing) {
        return existing;
      }
      
      // ✅ Try to insert new booking with specified units
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          slot_id: slotId,
          booking_date: bookingDate,
          resource_type: selectedResource,
          units: units,
          status: 'booked',
        })
        .select()
        .single();
      
      // ✅ Handle duplicate key error gracefully (race condition)
      if (error) {
        // Code 23505 = unique_violation in PostgreSQL
        if (error.code === '23505') {
          // Another request created it - fetch and return
          const { data: raceData } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', user.id)
            .eq('slot_id', slotId)
            .eq('booking_date', bookingDate)
            .eq('resource_type', selectedResource)
            .eq('status', 'booked')
            .single();
          
          if (raceData) return raceData;
        }
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success(t('laundry.bookingSuccess'));
      // ✅ Invalidate ALL related queries to refresh counters
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBookings'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('laundry.bookingError'));
    },
  });

  // ✅ Cancel booking mutation
  // Updates booking status to 'cancelled' and records who cancelled it
  // This frees up all units (1 or 2) from that booking
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
      toast.success(t('laundry.cancelSuccess'));
      // ✅ Invalidate ALL related queries to update counters and availability
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyBookings'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('laundry.cancelError'));
    },
  });

  // ✅ Helper: Get all bookings for a specific slot and date
  const getBookingsForSlot = (slotId: string, date: Date) => {
    if (!bookings) return [];
    return bookings.filter(
      b => b.slot_id === slotId && b.booking_date === format(date, 'yyyy-MM-dd')
    );
  };

  // ✅ Helper: Calculate total units taken for a slot (sum of all booking units)
  const getTakenUnits = (slotId: string, date: Date) => {
    const slotBookings = getBookingsForSlot(slotId, date);
    return slotBookings.reduce((sum, b) => sum + (b.units || 1), 0);
  };

  // ✅ Helper: Check if user can book based on weekly quota
  // LAV: max 3 units/week, ASC: max 2 bookings/week
  const canBookUnits = (units: number) => {
    const maxQuota = selectedResource === 'LAV' ? 3 : 2;
    return weeklyUnitsUsed + units <= maxQuota;
  };

  // ✅ Helper: Check if current user has booked this slot
  const hasUserBooked = (slotId: string, date: Date) => {
    return getBookingsForSlot(slotId, date).some(b => b.user_id === user?.id);
  };

  // ✅ Helper: Get user's booking for a specific slot
  const getUserBooking = (slotId: string, date: Date) => {
    return getBookingsForSlot(slotId, date).find(b => b.user_id === user?.id);
  };

  // ✅ Helper: Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // ✅ Use centralized slot schedule (10 slots, 90 min each, ending at 23:00)
  const timeSlots = dailySlots90EndAt23();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.laundry')}</h1>
          <p className="text-muted-foreground">{t('laundry.description')}</p>
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

        {/* Quota Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('laundry.weeklyQuota')}
              <Badge variant={canBookUnits(1) ? 'default' : 'destructive'}>
                {selectedResource === 'LAV' 
                  ? `${weeklyUnitsUsed}/3 ${t('laundry.washers')} units` 
                  : `${weeklyUnitsUsed}/2 ${t('laundry.dryers')}`}
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                {selectedResource === 'LAV' 
                  ? 'Maximum 3 washer units per week. Booking both washers counts as 2 units.' 
                  : 'Maximum 2 dryer bookings per week.'} Cancel slots you can't use.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={selectedResource} onValueChange={(v) => setSelectedResource(v as 'LAV' | 'ASC')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="LAV" className="flex items-center gap-2">
              <Droplet className="h-4 w-4" />
              {t('laundry.washers')} (2 machines)
            </TabsTrigger>
            <TabsTrigger value="ASC" className="flex items-center gap-2">
              <Wind className="h-4 w-4" />
              {t('laundry.dryers')} (1 machine)
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedResource} className="space-y-4">
            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
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
                              // Match slots handling both "HH:MM" and "HH:MM:SS" formats
                              const slot = slots?.find(
                                s => s.day_of_week === dayOfWeek && 
                                     s.start_time.substring(0, 5) === timeSlot.start && 
                                     s.end_time.substring(0, 5) === timeSlot.end
                              );
                              
                              if (!slot) {
                                return <td key={day.toISOString()} className="p-3 bg-muted/20"></td>;
                              }
                              
                              const slotBookings = getBookingsForSlot(slot.id, day);
                              const capacity = slot.capacity || (selectedResource === 'LAV' ? 2 : 1); // Use DB capacity
                              const takenUnits = getTakenUnits(slot.id, day);
                              const isFull = takenUnits >= capacity;
                              const userHasBooked = hasUserBooked(slot.id, day);
                              const userBooking = getUserBooking(slot.id, day);
                              const slotIsPast = isSlotPast(day, timeSlot.end);
                              const availableUnits = capacity - takenUnits;

                              return (
                                <td key={day.toISOString()} className="p-3">
                                  {userHasBooked ? (
                                    // ✅ USER'S BOOKING - Show "Cancel (You)" with units
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
                                          Cancel (You{selectedResource === 'LAV' && userBooking?.units ? ` – ${userBooking.units}` : ''})
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
                                  ) : selectedResource === 'LAV' ? (
                                    // ✅ LAV: Dropdown to book 1 or 2 washers
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full bg-green-100 hover:bg-green-200 border-green-300 text-green-900"
                                          disabled={createBooking.isPending || !canBookUnits(1)}
                                        >
                                          {createBooking.isPending ? (
                                            <span className="flex items-center gap-1">
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Booking...
                                            </span>
                                          ) : (
                                            <span className="flex items-center justify-between w-full">
                                              <span>Book ({takenUnits}/{capacity})</span>
                                              <ChevronDown className="h-3 w-3" />
                                            </span>
                                          )}
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="center">
                                        <DropdownMenuItem
                                          onClick={() => createBooking.mutate({ slotId: slot.id, date: day, units: 1 })}
                                          disabled={!canBookUnits(1) || availableUnits < 1}
                                        >
                                          Book 1 washer
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => createBooking.mutate({ slotId: slot.id, date: day, units: 2 })}
                                          disabled={!canBookUnits(2) || availableUnits < 2}
                                        >
                                          Book both (2)
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    // ✅ ASC: Simple book button (always 1 unit)
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full bg-green-100 hover:bg-green-200 border-green-300 text-green-900"
                                      onClick={() => createBooking.mutate({ slotId: slot.id, date: day, units: 1 })}
                                      disabled={!canBookUnits(1) || createBooking.isPending}
                                    >
                                      {createBooking.isPending ? (
                                        <span className="flex items-center gap-1">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Booking...
                                        </span>
                                      ) : (
                                        `Book (${takenUnits}/${capacity})`
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
            )}

            {/* Legend with color-coded examples and booking info */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
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
                  {selectedResource === 'LAV' && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      <strong>LAV Tip:</strong> Click the dropdown arrow to choose between booking 1 washer or both (2). 
                      Booking both counts as 2 units toward your weekly limit of 3.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Laundry;
