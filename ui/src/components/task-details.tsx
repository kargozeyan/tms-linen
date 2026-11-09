import {Descriptions} from 'antd';
import type {Task} from '../types/task';
import {formatDate} from '../utils/format';

export function TaskDetails({task}: {task: Task}) {
  return (
    <Descriptions
      bordered
      size="small"
      items={[
        {label: 'Type', children: task.task_type},
        {label: 'Status', children: task.status},
        {label: 'Planned start', children: formatDate(task.planned_start)},
        {label: 'Listing', children: task.listing_id ?? 'None'},
        {label: 'Reservation', children: task.reservation_id ?? 'None'},
      ]}
    />
  );
}
