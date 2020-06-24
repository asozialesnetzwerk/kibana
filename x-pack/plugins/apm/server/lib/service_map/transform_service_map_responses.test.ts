/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  AGENT_NAME,
  SERVICE_ENVIRONMENT,
  SERVICE_NAME,
  SPAN_DESTINATION_SERVICE_RESOURCE,
  SPAN_SUBTYPE,
  SPAN_TYPE,
} from '../../../common/elasticsearch_fieldnames';
import {
  transformServiceMapResponses,
  ServiceMapResponse,
} from './transform_service_map_responses';

const nodejsService = {
  [SERVICE_NAME]: 'opbeans-node',
  [SERVICE_ENVIRONMENT]: 'production',
  [AGENT_NAME]: 'nodejs',
};

const nodejsExternal = {
  [SPAN_DESTINATION_SERVICE_RESOURCE]: 'opbeans-node',
  [SPAN_TYPE]: 'external',
  [SPAN_SUBTYPE]: 'aa',
};

const javaService = {
  [SERVICE_NAME]: 'opbeans-java',
  [SERVICE_ENVIRONMENT]: 'production',
  [AGENT_NAME]: 'java',
};

describe('transformServiceMapResponses', () => {
  it('maps external destinations to internal services', () => {
    const response: ServiceMapResponse = {
      services: [nodejsService, javaService],
      discoveredServices: [
        {
          from: nodejsExternal,
          to: nodejsService,
        },
      ],
      connections: [
        {
          source: javaService,
          destination: nodejsExternal,
        },
      ],
    };

    const { elements } = transformServiceMapResponses(response);

    const connection = elements.find(
      (element) => 'source' in element.data && 'target' in element.data
    );

    // @ts-ignore
    expect(connection?.data.target).toBe('opbeans-node');

    expect(
      elements.find((element) => element.data.id === '>opbeans-node')
    ).toBeUndefined();
  });

  it('collapses external destinations based on span.destination.resource.name', () => {
    const response: ServiceMapResponse = {
      services: [nodejsService, javaService],
      discoveredServices: [
        {
          from: nodejsExternal,
          to: nodejsService,
        },
      ],
      connections: [
        {
          source: javaService,
          destination: nodejsExternal,
        },
        {
          source: javaService,
          destination: {
            ...nodejsExternal,
            [SPAN_TYPE]: 'foo',
          },
        },
      ],
    };

    const { elements } = transformServiceMapResponses(response);

    const connections = elements.filter((element) => 'source' in element.data);

    expect(connections.length).toBe(1);

    const nodes = elements.filter((element) => !('source' in element.data));

    expect(nodes.length).toBe(2);
  });

  it('picks the first span.type/subtype in an alphabetically sorted list', () => {
    const response: ServiceMapResponse = {
      services: [javaService],
      discoveredServices: [],
      connections: [
        {
          source: javaService,
          destination: nodejsExternal,
        },
        {
          source: javaService,
          destination: {
            ...nodejsExternal,
            [SPAN_TYPE]: 'foo',
          },
        },
        {
          source: javaService,
          destination: {
            ...nodejsExternal,
            [SPAN_SUBTYPE]: 'bb',
          },
        },
      ],
    };

    const { elements } = transformServiceMapResponses(response);

    const nodes = elements.filter((element) => !('source' in element.data));

    const nodejsNode = nodes.find((node) => node.data.id === '>opbeans-node');

    // @ts-ignore
    expect(nodejsNode?.data[SPAN_TYPE]).toBe('external');
    // @ts-ignore
    expect(nodejsNode?.data[SPAN_SUBTYPE]).toBe('aa');
  });

  it('processes connections without a matching "service" aggregation', () => {
    const response: ServiceMapResponse = {
      services: [javaService],
      discoveredServices: [],
      connections: [
        {
          source: javaService,
          destination: nodejsService,
        },
      ],
    };

    const { elements } = transformServiceMapResponses(response);

    expect(elements.length).toBe(3);
  });
});
