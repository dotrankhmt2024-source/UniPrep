import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

/**
 * Hai hook có kiểu của repo — dùng ở mọi nơi thay cho `useDispatch`/`useSelector` trần,
 * nhờ vậy `state.auth` và `dispatch(setCredentials(...))` đều được suy luận kiểu.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
