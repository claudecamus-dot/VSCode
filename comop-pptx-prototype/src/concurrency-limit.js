"use strict";

// Caps the number of concurrent async tasks; extra callers wait in a FIFO
// queue. Used to bound the powershell.exe processes spawned by the server.
function createLimiter(max) {
  const limit = Math.max(1, Math.floor(max) || 1);
  let active = 0;
  const queue = [];
  function next() {
    if (active >= limit || queue.length === 0) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  }
  return function run(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
  };
}

module.exports = { createLimiter };
