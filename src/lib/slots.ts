// Centralized slot generation for Gym and Laundry
// Each slot is 90 minutes, starting at 08:00 and ending at 23:00

export const TZ = 'Europe/Rome';

export interface TimeSlot {
  start: string;
  end: string;
  id: string; // For DB lookups like "s_0800"
}

/**
 * Generates 10 daily slots of 90 minutes each, ending at 23:00
 * Schedule: 08:00→09:30, 09:30→11:00, ..., 21:30→23:00
 */
export function dailySlots90EndAt23(): TimeSlot[] {
  const slots: TimeSlot[] = [
    { start: '08:00', end: '09:30', id: 's_0800' },
    { start: '09:30', end: '11:00', id: 's_0930' },
    { start: '11:00', end: '12:30', id: 's_1100' },
    { start: '12:30', end: '14:00', id: 's_1230' },
    { start: '14:00', end: '15:30', id: 's_1400' },
    { start: '15:30', end: '17:00', id: 's_1530' },
    { start: '17:00', end: '18:30', id: 's_1700' },
    { start: '18:30', end: '20:00', id: 's_1830' },
    { start: '20:00', end: '21:30', id: 's_2000' },
    { start: '21:30', end: '23:00', id: 's_2130' },
  ];
  return slots;
}

/**
 * Check if a slot has passed based on its end time
 * @param date - The date of the slot in local time
 * @param endTime - End time string like "09:30"
 * @returns true if the slot has passed
 */
export function isSlotPast(date: Date, endTime: string): boolean {
  const now = new Date();
  const slotDateTime = new Date(date);
  const [hours, minutes] = endTime.split(':').map(Number);
  slotDateTime.setHours(hours, minutes, 0, 0);
  return slotDateTime < now;
}
