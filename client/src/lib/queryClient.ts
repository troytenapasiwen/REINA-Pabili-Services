import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.error(`API Error: ${res.status}: ${text}`);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  isJSON: boolean = true,
): Promise<Response> {
  const options: RequestInit = {
    method,
    credentials: "include",
  };

  if (data) {
    if (isJSON && !(data instanceof FormData)) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    } else {
      // For FormData, don't set Content-Type as the browser will set it with the boundary
      options.body = data as BodyInit;
    }
  }

  const res = await fetch(url, options);
  await throwIfResNotOk(res);
  return res;
}

type ErrorBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401?: ErrorBehavior;
  on404?: ErrorBehavior;
}) => QueryFunction<T> =
  ({ on401 = "throw", on404 = "throw" }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    console.log(`Fetching data from: ${url}`);

    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      // Handle different status codes based on options
      if (on401 === "returnNull" && res.status === 401) {
        console.log(`${url} returned 401, returning null as configured`);
        return null;
      }

      if (on404 === "returnNull" && res.status === 404) {
        console.log(`${url} returned 404, returning null as configured`);
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Data received from ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
