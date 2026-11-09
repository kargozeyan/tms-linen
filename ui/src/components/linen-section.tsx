import {Descriptions, Typography} from 'antd';
import type {LinenValues} from '../types/task';
import {formatYesNo} from '../utils/format';

export function LinenSection({linen}: {linen: LinenValues}) {
  const items = [
    {label: 'Towels', children: linen.towels},
    {label: 'Sheets', children: linen.sheets},
    {label: 'Bathmats', children: linen.bathmats},
    {label: 'Handtowels', children: linen.handtowels},
    {label: 'Dishtowels', children: linen.dishtowels},
    {label: 'Total guests', children: linen.prepared_for_guests},
    {label: 'Infants (included in total)', children: linen.infants},
    {label: 'Requested sofabed', children: formatYesNo(linen.requested_sofabed)},
  ];

  if (linen.requested_sofabeds_count > 0) {
    items.push({label: 'Requested sofabed count', children: linen.requested_sofabeds_count});
  }

  return (
    <section>
      <Typography.Title level={3}>Linen</Typography.Title>
      <Descriptions bordered size="small" items={items} />
    </section>
  );
}
