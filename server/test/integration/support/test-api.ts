import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {createApp} from '../../../src/app';
import {findEvent} from './fixtures';

export type TestApi = Awaited<ReturnType<typeof startTestApi>>;

type ApiResponse = {status: number; body: any};

export async function startTestApi() {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function send(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {'content-type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return {status: response.status, body: await response.json()};
  }

  function postEvent(event: unknown) {
    return send('POST', '/events/reservation', event);
  }

  return {
    getTasks: () => send('GET', '/tasks'),
    getTask: (taskId: string) => send('GET', `/tasks/${taskId}`),
    getTaskHistory: (taskId: string) => send('GET', `/tasks/${taskId}/linen/history`),
    createTask: (task: unknown) => send('POST', '/tasks', task),
    updateTask: (taskId: string, changes: unknown) => send('PATCH', `/tasks/${taskId}`, changes),
    postEvent,
    sendEvents: async (...eventIds: string[]) => {
      const responses: ApiResponse[] = [];
      for (const eventId of eventIds) {
        responses.push(await postEvent(findEvent(eventId)));
      }
      return responses;
    },
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}
