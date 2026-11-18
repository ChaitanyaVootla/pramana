"use client";

import { useOfflineSetup } from "./offline";

/** Mount on /learn: offline study (service worker, the next days' cards on the device, queued answers). */
export function OfflineSetup() {
  useOfflineSetup();
  return null;
}
