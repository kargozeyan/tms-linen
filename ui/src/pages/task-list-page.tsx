import {Alert, Table, type TableColumnsType, Typography} from 'antd';
import {Link} from 'react-router';
import {useFetch} from '../hooks/use-fetch';
import type {Task} from '../types/task';
import {formatDate} from '../utils/format';

const COLUMNS: TableColumnsType<Task> = [
  {
    title: 'Task',
    dataIndex: 'task_id',
    render: (taskId: string) => <Link to={`/tasks/${encodeURIComponent(taskId)}`}>{taskId}</Link>,
  },
  {title: 'Type', dataIndex: 'task_type'},
  {title: 'Status', dataIndex: 'status'},
  {title: 'Listing', dataIndex: 'listing_id'},
  {title: 'Reservation', dataIndex: 'reservation_id'},
  {title: 'Planned start', dataIndex: 'planned_start', render: formatDate},
];

export function TaskListPage() {
  const {data: tasks, loading, error} = useFetch<Task[]>('/tasks');

  return (
    <>
      <Typography.Title level={2}>Tasks</Typography.Title>
      {error ? (
        <Alert type="error" title={error} />
      ) : (
        <Table rowKey="task_id" columns={COLUMNS} dataSource={tasks} loading={loading} pagination={false} />
      )}
    </>
  );
}
