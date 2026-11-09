import {Alert, Flex, Spin, Typography} from 'antd';
import {Link, useParams} from 'react-router';
import {LinenHistoryTable} from '../components/linen-history-table';
import {LinenSection} from '../components/linen-section';
import {TaskDetails} from '../components/task-details';
import {useFetch} from '../hooks/use-fetch';
import type {LinenHistoryEntry, Task} from '../types/task';

export function TaskPage() {
  const {id = ''} = useParams();
  const taskPath = `/tasks/${encodeURIComponent(id)}`;

  const {data: task, loading: taskLoading, error: taskError} = useFetch<Task>(taskPath);
  const {
    data: history = [],
    loading: historyLoading,
    error: historyError,
  } = useFetch<LinenHistoryEntry[]>(`${taskPath}/linen/history`);

  const error = taskError ?? historyError;

  if (taskLoading) {
    return <Spin />;
  }

  if (error || !task) {
    return (
      <Flex vertical gap="middle">
        <Link to="/">Back to tasks</Link>
        <Alert type="error" title={error} />
      </Flex>
    );
  }

  return (
    <Flex vertical gap="large">
      <Link to="/">Back to tasks</Link>
      <Typography.Title level={2} style={{margin: 0}}>
        {task.task_id}
      </Typography.Title>
      <TaskDetails task={task} />
      {task.linen && <LinenSection linen={task.linen} />}
      <LinenHistoryTable history={history} loading={historyLoading} />
    </Flex>
  );
}
