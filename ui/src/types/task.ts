export type LinenValues = {
  sheets: number;
  towels: number;
  bathmats: number;
  handtowels: number;
  dishtowels: number;
  prepared_for_guests: number;
  requested_sofabeds_count: number;
  actual_guests: number;
  infants: number;
  number_of_guests_override: number | null;
  requested_sofabed: boolean;
};

export type Task = {
  task_id: string;
  task_type: string;
  status: string;
  listing_id: string | null;
  reservation_id: string | null;
  planned_start: string;
  linen: LinenValues | null;
};

export type LinenHistoryEntry = {
  id: number;
  event_id: string | null;
  reason: string;
  old_values: LinenValues | null;
  new_values: LinenValues | null;
  created_at: string;
};
