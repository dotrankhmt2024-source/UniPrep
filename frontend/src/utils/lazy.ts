import { lazy as reactLazy, type ComponentType } from 'react';

export function lazy<T extends ComponentType<unknown>>(importFunc: () => Promise<{ default: T }>) {
	return reactLazy(importFunc);
}
