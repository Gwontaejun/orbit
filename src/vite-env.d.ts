/// <reference types="vite/client" />

import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    // React Three Fiber augments JSX through the inherited element map.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ThreeElements {}
  }
}
