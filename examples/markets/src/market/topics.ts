/**
 * Who follows which topic, for a market to tell. Both markets (sim/, kraken/) keep their listeners here and say when
 * a topic has changed; the hub reads it once and hands the same value to everyone following it.
 */
import type { Readers, Topic, TopicData } from "./types";

/** One key a topic: two panes on the same quote share one entry. */
export const topicKey = (t: Topic) =>
  `${t.channel}:${"symbol" in t ? (t.symbol ?? "*") : "*"}:${"range" in t ? t.range : ""}`;

/** `snapshot`, from a reader for every channel. */
export const readWith =
  (readers: Readers) =>
  <T extends Topic>(topic: T): TopicData<T> =>
    (readers[topic.channel] as (t: Topic) => TopicData<T>)(topic);

type Listener = (data: unknown) => void;

export interface TopicHub {
  /** Follow `topic` until the function returned is called. */
  add<T extends Topic>(topic: T, onData: (data: TopicData<T>) => void): () => void;
  /** Read each followed topic that `changed` says has news, and call its listeners with it. */
  notify(changed: (topic: Topic) => boolean): void;
}

export function createTopicHub(read: <T extends Topic>(topic: T) => TopicData<T>): TopicHub {
  const subs = new Map<string, { topic: Topic; listeners: Set<Listener> }>();
  return {
    add(topic, onData) {
      const key = topicKey(topic);
      let sub = subs.get(key);
      if (!sub) subs.set(key, (sub = { topic, listeners: new Set() }));
      const listener = onData as Listener;
      sub.listeners.add(listener);
      return () => {
        sub.listeners.delete(listener);
        if (!sub.listeners.size) subs.delete(key);
      };
    },
    notify(changed) {
      for (const { topic, listeners } of Array.from(subs.values())) {
        if (!changed(topic)) continue;
        const data = read(topic);
        // A copy: a listener may unsubscribe while being called.
        for (const l of Array.from(listeners)) l(data);
      }
    },
  };
}
