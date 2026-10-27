export function netOnFace(data, net, side) {
  const front = side !== 'back';
  return {
    pads: data.pads.filter(pad => pad.net === net && (front ? pad.front : pad.back)),
    tracks: data.tracks.filter(track => track.net === net && track.front === front)
  };
}
