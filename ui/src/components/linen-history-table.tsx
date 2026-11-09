import {Flex, Table, type TableColumnsType, Typography} from 'antd';
import type {LinenHistoryEntry, LinenValues} from '../types/task';
import {formatDate, formatYesNo} from '../utils/format';

const COLUMNS: TableColumnsType<LinenHistoryEntry> = [
  {title: 'Date', dataIndex: 'created_at', render: formatDate},
  {title: 'Reason', dataIndex: 'reason'},
  {title: 'Changes', key: 'changes', render: (_, row) => <LinenChanges row={row} />},
];

type LinenHistoryTableProps = {
  history: LinenHistoryEntry[];
  loading: boolean;
};

export function LinenHistoryTable({history, loading}: LinenHistoryTableProps) {
  return (
    <section>
      <Typography.Title level={3}>Change history</Typography.Title>
      <Table rowKey="id" columns={COLUMNS} dataSource={history} loading={loading} pagination={false} />
    </section>
  );
}

function LinenChanges({row}: {row: LinenHistoryEntry}) {
  const changes = findChanges(row.old_values, row.new_values);

  if (changes.length === 0) {
    return <Typography.Text type="secondary">No changes</Typography.Text>;
  }

  return (
    <Flex vertical>
      {changes.map(({field, oldValue, newValue}) => (
        <span key={field}>
          {field}: {formatValue(oldValue)} {'->'} {formatValue(newValue)}
        </span>
      ))}
    </Flex>
  );
}

function findChanges(oldValues: LinenValues | null, newValues: LinenValues | null) {
  const fields = Object.keys({...oldValues, ...newValues}) as (keyof LinenValues)[];

  return fields
    .map((field) => ({field, oldValue: oldValues?.[field], newValue: newValues?.[field]}))
    .filter(({oldValue, newValue}) => oldValue != newValue);
}

function formatValue(value: LinenValues[keyof LinenValues] | undefined) {
  if (typeof value === 'boolean') {
    return formatYesNo(value);
  }

  return value ?? 'None';
}
