Review this function for correctness. It is supposed to return true iff `date` falls within [start, end] INCLUSIVE, treating all three as UTC calendar dates (time-of-day ignored).

    export function inRange(date, start, end) {
      const d = Date.parse(date.slice(0, 10));
      return d > Date.parse(start) && d < Date.parse(end);
    }

Probe specifically: are the boundary comparisons inclusive as specified? What happens when date equals a boundary? Report concrete defects with the input that triggers each. Skip style.
