// Source-verification examples only. These do not execute a payment handler
// or import RDI2 into the runtime. Amounts/recipients describe independent
// acceptance expectations for the future Step 24B implementation.
export interface M09SourceExample {
  name: string;
  pending: {
    id: string;
    kind: string;
    amount: number;
    destination: string;
    causedByOwnCard?: boolean;
    forbidden?: string;
  } | null;
  expected: {
    legal: boolean;
    payerStashLoss?: number;
    innSupplies?: number;
    destination?: string;
    innNetChange?: number;
    anteSatisfied?: boolean;
    contextId?: string;
    untouchedFutureContexts?: string[];
  };
}
export const m09SourceExamples: M09SourceExample[] = [
  {
    name: '1-Gold payment to Inn',
    pending: { id: 'one', kind: 'PAY_TO_INN', amount: 1, destination: 'INN' },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 1,
      destination: 'INN',
      innNetChange: 0,
    },
  },
  {
    name: 'multi-Gold single payment',
    pending: { id: 'multi', kind: 'PAY_TO_INN', amount: 3, destination: 'INN' },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 3,
      destination: 'INN',
      innNetChange: 0,
    },
  },
  {
    name: 'payment to another player',
    pending: {
      id: 'other',
      kind: 'PAY_TO_PLAYER',
      amount: 2,
      destination: 'PLAYER_B',
    },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 2,
      destination: 'PLAYER_B',
    },
  },
  {
    name: 'ante supplied to pot',
    pending: { id: 'ante', kind: 'ANTE_TO_POT', amount: 2, destination: 'POT' },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 2,
      destination: 'POT',
      anteSatisfied: true,
    },
  },
  {
    name: 'another player taking Gold',
    pending: {
      id: 'taken',
      kind: 'GOLD_TAKEN_BY_OTHER_PLAYER',
      amount: 3,
      destination: 'TAKING_PLAYER',
    },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 3,
      destination: 'TAKING_PLAYER',
    },
  },
  {
    name: 'payment caused by your own card',
    pending: {
      id: 'own',
      kind: 'PAY_TO_INN',
      amount: 2,
      destination: 'INN',
      causedByOwnCard: true,
    },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 2,
      destination: 'INN',
      innNetChange: 0,
    },
  },
  {
    name: 'four separate payment contexts',
    pending: {
      id: 'payment_1',
      kind: 'PAY_TO_INN',
      amount: 1,
      destination: 'INN',
    },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 1,
      destination: 'INN',
      contextId: 'payment_1',
      innNetChange: 0,
      untouchedFutureContexts: ['payment_2', 'payment_3', 'payment_4'],
    },
  },
  {
    name: 'explicit non-substitutable payment',
    pending: {
      id: 'blocked',
      kind: 'PAY_TO_PLAYER',
      amount: 2,
      destination: 'PLAYER_B',
      forbidden: 'PAYMENT_NON_SUBSTITUTABLE',
    },
    expected: { legal: false },
  },
  { name: 'no pending Gold loss', pending: null, expected: { legal: false } },
  {
    name: 'original recipient/destination preserved',
    pending: {
      id: 'original',
      kind: 'PAY_TO_PLAYER',
      amount: 4,
      destination: 'ORIGINAL_PLAYER_C',
    },
    expected: {
      legal: true,
      payerStashLoss: 0,
      innSupplies: 4,
      destination: 'ORIGINAL_PLAYER_C',
    },
  },
];
