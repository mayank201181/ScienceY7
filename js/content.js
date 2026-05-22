// Loads the topic index and individual topic JSON files from /content.
const Content = (() => {
  let index = null;
  const cache = {};

  async function getIndex() {
    if (index) return index;
    const res = await fetch('content/index.json');
    if (!res.ok) throw new Error('Could not load topic index');
    index = await res.json();
    return index;
  }

  async function getTopic(code) {
    if (cache[code]) return cache[code];
    const res = await fetch(`content/${code}.json`);
    if (!res.ok) throw new Error(`Could not load topic ${code}`);
    const data = await res.json();
    cache[code] = data;
    return data;
  }

  return { getIndex, getTopic };
})();
