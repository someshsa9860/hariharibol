'use client';

import { useEffect, useState } from 'react';

/**
 * "Open in the app": the app's own address scheme. It is a button the person presses, not something that runs on its
 * own — browsers cannot tell whether an app is installed, and a timer that guesses wrongly sends people to a store
 * for an app they already have. Shown only on phones and tablets; if nothing handles the scheme, nothing happens and the
 * store badges below are right there.
 */
export function OpenInApp({ path }: { path: string }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); }, []);
  if (!mobile) return null;
  return <a className="btn btn-primary btn-block" href={`hariharibol://open?path=${encodeURIComponent(path.startsWith('/') ? path : `/${path}`)}`}>Open in the app</a>;
}
