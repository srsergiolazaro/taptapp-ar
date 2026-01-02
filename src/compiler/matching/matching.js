import TinyQueue from "tinyqueue";
import { compute as hammingCompute } from "./hamming-distance.js";
import { computeHoughMatches } from "./hough.js";
import { computeHomography } from "./ransacHomography.js";
import { multiplyPointHomographyInhomogenous, matrixInverse33 } from "../utils/geometry.js";

const INLIER_THRESHOLD = 3;
//const MIN_NUM_INLIERS = 8;  //default
const MIN_NUM_INLIERS = 6;
const CLUSTER_MAX_POP = 8;
const HAMMING_THRESHOLD = 0.7;

// match list of querpoints against pre-built list of keyframes
const match = ({ keyframe, querypoints, querywidth, queryheight, debugMode }) => {
  let debugExtra = {};

  const matches = [];
  for (let j = 0; j < querypoints.length; j++) {
    const querypoint = querypoints[j];
    const col = querypoint.maxima ? keyframe.max : keyframe.min;
    if (!col || col.x.length === 0) continue;

    const rootNode = col.t;

    const keypointIndexes = [];
    const queue = new TinyQueue([], (a1, a2) => {
      return a1.d - a2.d;
    });

    // query potential candidates from the columnar tree
    _query({
      node: rootNode,
      descriptors: col.d,
      querypoint,
      queue,
      keypointIndexes,
      numPop: 0
    });

    let bestIndex = -1;
    let bestD1 = Number.MAX_SAFE_INTEGER;
    let bestD2 = Number.MAX_SAFE_INTEGER;

    for (let k = 0; k < keypointIndexes.length; k++) {
      const idx = keypointIndexes[k];

      // Access descriptor directly from binary buffer (Zero-copy)
      const keypointDescriptor = col.d.subarray(idx * 84, (idx + 1) * 84);

      const d = hammingCompute({ v1: keypointDescriptor, v2: querypoint.descriptors });
      if (d < bestD1) {
        bestD2 = bestD1;
        bestD1 = d;
        bestIndex = idx;
      } else if (d < bestD2) {
        bestD2 = d;
      }
    }

    if (
      bestIndex !== -1 &&
      (bestD2 === Number.MAX_SAFE_INTEGER || (1.0 * bestD1) / bestD2 < HAMMING_THRESHOLD)
    ) {
      matches.push({
        querypoint,
        keypoint: {
          x: col.x[bestIndex],
          y: col.y[bestIndex],
          angle: col.a[bestIndex]
        }
      });
    }
  }

  if (debugMode) {
    debugExtra.matches = matches;
  }

  if (matches.length < MIN_NUM_INLIERS) return { debugExtra };

  const houghMatches = computeHoughMatches({
    keywidth: keyframe.w, // Protocol V3 uses .w, .h
    keyheight: keyframe.h,
    querywidth,
    queryheight,
    matches,
  });

  if (debugMode) {
    debugExtra.houghMatches = houghMatches;
  }

  const H = computeHomography({
    srcPoints: houghMatches.map((m) => [m.keypoint.x, m.keypoint.y]),
    dstPoints: houghMatches.map((m) => [m.querypoint.x, m.querypoint.y]),
    keyframe: { width: keyframe.w, height: keyframe.h },
  });

  if (H === null) return { debugExtra };

  const inlierMatches = _findInlierMatches({
    H,
    matches: houghMatches,
    threshold: INLIER_THRESHOLD,
  });

  if (debugMode) {
    debugExtra.inlierMatches = inlierMatches;
  }

  if (inlierMatches.length < MIN_NUM_INLIERS) return { debugExtra };

  // Second pass with homography guided matching
  const HInv = matrixInverse33(H, 0.00001);
  const dThreshold2 = 10 * 10;
  const matches2 = [];

  for (let j = 0; j < querypoints.length; j++) {
    const querypoint = querypoints[j];
    const mapquerypoint = multiplyPointHomographyInhomogenous([querypoint.x, querypoint.y], HInv);

    let bestIndex = -1;
    let bestD1 = Number.MAX_SAFE_INTEGER;
    let bestD2 = Number.MAX_SAFE_INTEGER;

    const col = querypoint.maxima ? keyframe.max : keyframe.min;
    if (!col) continue;

    for (let k = 0; k < col.x.length; k++) {
      const dx = col.x[k] - mapquerypoint[0];
      const dy = col.y[k] - mapquerypoint[1];
      const d2 = dx * dx + dy * dy;

      if (d2 > dThreshold2) continue;

      const keypointDescriptor = col.d.subarray(k * 84, (k + 1) * 84);
      const d = hammingCompute({ v1: keypointDescriptor, v2: querypoint.descriptors });

      if (d < bestD1) {
        bestD2 = bestD1;
        bestD1 = d;
        bestIndex = k;
      } else if (d < bestD2) {
        bestD2 = d;
      }
    }

    if (
      bestIndex !== -1 &&
      (bestD2 === Number.MAX_SAFE_INTEGER || (1.0 * bestD1) / bestD2 < HAMMING_THRESHOLD)
    ) {
      matches2.push({
        querypoint,
        keypoint: {
          x: col.x[bestIndex],
          y: col.y[bestIndex],
          angle: col.a[bestIndex]
        }
      });
    }
  }

  if (debugMode) {
    debugExtra.matches2 = matches2;
  }

  const houghMatches2 = computeHoughMatches({
    keywidth: keyframe.w,
    keyheight: keyframe.h,
    querywidth,
    queryheight,
    matches: matches2,
  });

  if (debugMode) {
    debugExtra.houghMatches2 = houghMatches2;
  }

  const H2 = computeHomography({
    srcPoints: houghMatches2.map((m) => [m.keypoint.x, m.keypoint.y]),
    dstPoints: houghMatches2.map((m) => [m.querypoint.x, m.querypoint.y]),
    keyframe: { width: keyframe.w, height: keyframe.h },
  });

  if (H2 === null) return { debugExtra };

  const inlierMatches2 = _findInlierMatches({
    H: H2,
    matches: houghMatches2,
    threshold: INLIER_THRESHOLD,
  });

  if (debugMode) {
    debugExtra.inlierMatches2 = inlierMatches2;
  }

  return { H: H2, matches: inlierMatches2, debugExtra };
};

const _query = ({ node, descriptors, querypoint, queue, keypointIndexes, numPop }) => {
  const isLeaf = node[0] === 1;
  const centerIdx = node[1];
  const childrenOrIndices = node[2];

  if (isLeaf) {
    for (let i = 0; i < childrenOrIndices.length; i++) {
      keypointIndexes.push(childrenOrIndices[i]);
    }
    return;
  }

  const distances = [];
  for (let i = 0; i < childrenOrIndices.length; i++) {
    const childNode = childrenOrIndices[i];
    const cIdx = childNode[1];

    const d = hammingCompute({
      v1: descriptors.subarray(cIdx * 84, (cIdx + 1) * 84),
      v2: querypoint.descriptors,
    });
    distances.push(d);
  }

  let minD = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < childrenOrIndices.length; i++) {
    minD = Math.min(minD, distances[i]);
  }

  for (let i = 0; i < childrenOrIndices.length; i++) {
    if (distances[i] !== minD) {
      queue.push({ node: childrenOrIndices[i], d: distances[i] });
    }
  }
  for (let i = 0; i < childrenOrIndices.length; i++) {
    if (distances[i] === minD) {
      _query({ node: childrenOrIndices[i], descriptors, querypoint, queue, keypointIndexes, numPop });
    }
  }

  if (numPop < CLUSTER_MAX_POP && queue.length > 0) {
    const { node } = queue.pop();
    numPop += 1;
    _query({ node, descriptors, querypoint, queue, keypointIndexes, numPop });
  }
};

const _findInlierMatches = (options) => {
  const { H, matches, threshold } = options;

  const threshold2 = threshold * threshold;

  const goodMatches = [];
  for (let i = 0; i < matches.length; i++) {
    const querypoint = matches[i].querypoint;
    const keypoint = matches[i].keypoint;
    const mp = multiplyPointHomographyInhomogenous([keypoint.x, keypoint.y], H);
    const d2 =
      (mp[0] - querypoint.x) * (mp[0] - querypoint.x) +
      (mp[1] - querypoint.y) * (mp[1] - querypoint.y);
    if (d2 <= threshold2) {
      goodMatches.push(matches[i]);
    }
  }
  return goodMatches;
};

export { match };
