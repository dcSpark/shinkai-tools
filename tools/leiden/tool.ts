import {
  Clustering,
  GradientDescentVOSLayoutAlgorithm,
  Layout,
  LeidenAlgorithm,
  Network,
} from 'npm:networkanalysis-ts@1.0.0';

type Configurations = {};
type Parameters = {
  edges: [number, number, number][];
  resolution?: number; // Make resolution optional
  nIterations?: number | null; // Make nIterations optional
  nRandomStarts?: number;
  convergenceThreshold?: number; // Add optional convergence threshold
};
type Result = {
  bestClustering: { nNodes: number; clusters: number[]; nClusters: number };
  bestLayout: { nNodes: number; coordinates: number[][] };
};
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = (
  _configurations,
  parameters,
): Promise<Result> => {
  const {
    edges,
    resolution = 1.0, // Set default resolution to 1.0
    nIterations = null, // Set default nIterations to null
    nRandomStarts = 10, // Set default nRandomStarts to 10
    convergenceThreshold = 0.0001, // Set default convergenceThreshold to 0.0001
  } = parameters;

  function runLeidenAlgorithm(
    edges: [number, number, number][],
    resolution: number,
    nIterations: number | null,
    nRandomStarts: number,
    convergenceThreshold?: number, // Add optional convergence threshold
  ) {
    const adjustedEdges = edges.map((edge) => [
      edge[0] - 1,
      edge[1] - 1,
      edge[2],
    ]);
    const nNodes =
      Math.max(...adjustedEdges.flatMap((edge) => [edge[0], edge[1]])) + 1;
    const network = new Network({
      nNodes: nNodes,
      setNodeWeightsToTotalEdgeWeights: true,
      edges: [
        adjustedEdges.map((edge) => edge[0]),
        adjustedEdges.map((edge) => edge[1]),
      ],
      edgeWeights: adjustedEdges.map((edge) => edge[2]),
      sortedEdges: false,
      checkIntegrity: true,
    });

    const normalizedNetwork =
      network.createNormalizedNetworkUsingAssociationStrength();

    let bestClustering: Clustering = new Clustering({ nNodes: 0 });
    let maxQuality = Number.NEGATIVE_INFINITY;
    const clusteringAlgorithm = new LeidenAlgorithm();
    clusteringAlgorithm.setResolution(resolution);
    let previousQuality = Number.NEGATIVE_INFINITY;
    let iteration = 0;

    if (nIterations !== null) {
      clusteringAlgorithm.setNIterations(nIterations);
      for (let i = 0; i < nRandomStarts; i++) {
        const clustering = new Clustering({
          nNodes: normalizedNetwork.getNNodes(),
        });
        clusteringAlgorithm.improveClustering(normalizedNetwork, clustering);
        const quality = clusteringAlgorithm.calcQuality(
          normalizedNetwork,
          clustering,
        );
        if (quality > maxQuality) {
          bestClustering = clustering;
          maxQuality = quality;
        }
      }
    } else {
      while (true) {
        const clustering = new Clustering({
          nNodes: normalizedNetwork.getNNodes(),
        });
        clusteringAlgorithm.improveClustering(normalizedNetwork, clustering);
        const quality = clusteringAlgorithm.calcQuality(
          normalizedNetwork,
          clustering,
        );
        if (quality > maxQuality) {
          bestClustering = clustering;
          maxQuality = quality;
        }
        if (
          convergenceThreshold &&
          Math.abs(quality - previousQuality) < convergenceThreshold
        ) {
          break;
        }
        previousQuality = quality;
        iteration++;
      }
    }
    bestClustering.orderClustersByNNodes();

    let bestLayout: Layout = new Layout({ nNodes: 0 });
    let minQuality = Number.POSITIVE_INFINITY;
    const layoutAlgorithm = new GradientDescentVOSLayoutAlgorithm();
    layoutAlgorithm.setAttraction(2);
    layoutAlgorithm.setRepulsion(1);
    previousQuality = Number.POSITIVE_INFINITY;
    iteration = 0;

    if (nIterations !== null) {
      for (let i = 0; i < nRandomStarts; i++) {
        const layout = new Layout({ nNodes: normalizedNetwork.getNNodes() });
        layoutAlgorithm.improveLayout(normalizedNetwork, layout);
        const quality = layoutAlgorithm.calcQuality(normalizedNetwork, layout);
        if (quality < minQuality) {
          bestLayout = layout;
          minQuality = quality;
        }
      }
    } else {
      while (true) {
        const layout = new Layout({ nNodes: normalizedNetwork.getNNodes() });
        layoutAlgorithm.improveLayout(normalizedNetwork, layout);
        const quality = layoutAlgorithm.calcQuality(normalizedNetwork, layout);
        if (quality < minQuality) {
          bestLayout = layout;
          minQuality = quality;
        }
        if (
          convergenceThreshold &&
          Math.abs(quality - previousQuality) < convergenceThreshold
        ) {
          break;
        }
        previousQuality = quality;
        iteration++;
      }
    }
    bestLayout.standardize(true);

    return {
      bestClustering: {
        nNodes: bestClustering.getNNodes(),
        clusters: bestClustering.getClusters(),
        nClusters: bestClustering.getNClusters(),
      },
      bestLayout: {
        nNodes: bestLayout.getNNodes(),
        coordinates: bestLayout.getCoordinates(),
      },
    };
  }

  const results = runLeidenAlgorithm(
    edges,
    resolution,
    nIterations,
    nRandomStarts,
    convergenceThreshold, // Pass convergence threshold
  );
  return Promise.resolve({ ...results });
};
