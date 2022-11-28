import { useRef, useEffect } from "react";
/**
 * @param effect
 * @param dependencies
 *
 */
export default function useNoInitialEffect(effect, dependencies) {
  const initialRender = useRef(true);
  useEffect(() => {
    let effectReturns = () => {};
    if (initialRender.current) {
      initialRender.current = false;
    } else {
      effectReturns = effect();
    }
    if (effectReturns && typeof effectReturns === "function") {
      return effectReturns;
    }
    return undefined;
  }, dependencies);
}
