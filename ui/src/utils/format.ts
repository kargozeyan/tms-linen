export function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function formatYesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}
