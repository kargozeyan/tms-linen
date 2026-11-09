import {Layout} from 'antd';
import {Navigate, Route, Routes} from 'react-router';
import {TaskListPage} from './pages/task-list-page';
import {TaskPage} from './pages/task-page';

export function App() {
  return (
    <Layout style={{minHeight: '100vh'}}>
      <Layout.Content style={{padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto'}}>
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
