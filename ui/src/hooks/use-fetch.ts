import {useEffect, useState} from 'react';

const API_URL = 'http://localhost:3000';

export function useFetch<T>(path: string) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setLoading(true);
    setError(undefined);

    fetch(`${API_URL}${path}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        setData(await response.json());
      })
      .catch((error: Error) => setError(error.message))
      .finally(() => setLoading(false));
  }, [path]);

  return {data, loading, error};
}

async function getErrorMessage(response: Response) {
  const body = await response.json();
  return body?.error ?? `Request failed with status ${response.status}`;
}
