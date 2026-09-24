import { useCallback, useState } from 'react';

interface UseMutationOptions<TResult> {
	onSuccess?: (data: TResult) => void;
	onError?: (error: unknown) => void;
}

export function useMutation<TArgs extends unknown[], TResult>(
	mutationFn: (...args: TArgs) => Promise<TResult>,
	options?: UseMutationOptions<TResult>,
) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const mutate = useCallback(
		async (...args: TArgs) => {
			setIsLoading(true);
			setError(null);
			try {
				const result = await mutationFn(...args);
				options?.onSuccess?.(result);
				return result;
			} catch (err) {
				setError(err);
				options?.onError?.(err);
				throw err;
			} finally {
				setIsLoading(false);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[mutationFn],
	);

	return { mutate, isLoading, error };
}
