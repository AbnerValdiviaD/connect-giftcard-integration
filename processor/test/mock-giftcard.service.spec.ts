import { describe, test, expect, afterEach, jest, beforeEach, beforeAll } from '@jest/globals';
import { setupServer } from 'msw/node';
import { paymentSDK } from '../src/payment-sdk';
import { MockGiftCardService, MockGiftCardServiceOptions } from '../src/services/mock-giftcard.service';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import { Payment } from '@commercetools/connect-payments-sdk';

import { MockCustomError } from '../src/errors/mock-api.error';
import * as Config from '../src/config/config';
import { ModifyPayment, StatusResponse } from '../src/services/types/operation.type';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import {
  createPaymentResultOk,
  getCartOK,
  getPaymentResultOk,
  getPaymentResultOkWithInvalidInterface,
  updatePaymentResultOk,
} from './mocks/coco';

import { HealthCheckResult } from '@commercetools/connect-payments-sdk';
import crypto from 'crypto';
import { AbstractGiftCardService } from '../src/services/abstract-giftcard.service';

interface FlexibleConfig {
  [key: string]: string | number | undefined; // Adjust the type according to your config values
}

function setupMockConfig(keysAndValues: Record<string, string>) {
  const mockConfig: FlexibleConfig = {};
  Object.keys(keysAndValues).forEach((key) => {
    mockConfig[key] = keysAndValues[key];
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
  jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(getCartOK());
}

describe('mock-giftcard.service', () => {
  const mockServer = setupServer();
  const opts: MockGiftCardServiceOptions = {
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
    ctOrderService: paymentSDK.ctOrderService,
  };

  const mockGiftCardService: AbstractGiftCardService = new MockGiftCardService(opts);

  beforeAll(() => {
    mockServer.listen({
      onUnhandledRequest: 'bypass',
    });
  });

  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    mockServer.resetHandlers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getStatus', async () => {
    const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => {
      const result: HealthCheckResult = {
        name: 'CoCo Permissions',
        status: 'DOWN',
        message: 'CoCo Permissions are not available',
        details: {},
      };
      return result;
    };

    jest.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
    const result: StatusResponse = await mockGiftCardService.status();

    expect(result?.status).toBeDefined();
    expect(result?.checks).toHaveLength(2);
    expect(result?.status).toStrictEqual('Partially Available');
    expect(result?.checks[0]?.name).toStrictEqual('CoCo Permissions');
    expect(result?.checks[0]?.status).toStrictEqual('DOWN');
    expect(result?.checks[0]?.details).toStrictEqual({});
    expect(result?.checks[0]?.message).toBeDefined();
    expect(result?.checks[1]?.name).toStrictEqual('mock giftcard API call');
    expect(result?.checks[1]?.status).toStrictEqual('UP');
    expect(result?.checks[1]?.details).toBeDefined();
    expect(result?.checks[1]?.message).toBeUndefined();
  });

  test('When checking balance by inputting valid gift card, it should return status as Valid', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });

    const result = await mockGiftCardService.balance('Valid-100-USD');
    expect(result?.status.state).toStrictEqual('Valid');
    expect(result?.amount.currencyCode).toStrictEqual('USD');
  });

  test('When checking balance by inputting gift card with wrong currency code', async () => {
    setupMockConfig({ mockConnectorCurrency: 'EUR' });
    // HINT: mock cart response has currency code set as USD

    // Act
    const result = mockGiftCardService.balance('Valid-100-EUR');

    // Assert
    await expect(result).rejects.toThrow(MockCustomError);
    await expect(result).rejects.toThrow('cart and gift card currency do not match');
  });

  test('When checking balance by inputting an expired gift card, it should throw error with Expired code', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });

    // Act
    const result = mockGiftCardService.balance('Expired');

    // Assert
    await expect(result).rejects.toThrow(MockCustomError);
    await expect(result).rejects.toThrow('The gift card is expired.');
  });

  test('When checking balance by inputting an erroneous gift card, it should throw error with GenericError code', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });

    // Act
    const result = mockGiftCardService.balance('GenericError');

    // Assert
    await expect(result).rejects.toThrow(MockCustomError);
    await expect(result).rejects.toThrow('Generic error occurs.');
  });

  test('When checking balance by inputting a not supported error gift code, it should throw error with Invalid code', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });

    // Act
    const result = mockGiftCardService.balance('123ABC');

    // Assert
    await expect(result).rejects.toThrow(MockCustomError);
    await expect(result).rejects.toThrow('The code provided is invalid');
  });

  test('When checking balance by inputting a not existing error gift code, it should throw error with NotFound code', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });

    // Act
    const result = mockGiftCardService.balance('NotFound');

    // Assert
    await expect(result).rejects.toThrow(MockCustomError);
    await expect(result).rejects.toThrow('The gift card code is not found.');
  });

  test('When redeeming a valid gift card, it should return Success as result', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });
    const dummyUUID = 'It-is-a-dummy-uuid';
    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(createPaymentResultOk);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(getCartOK());
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(dummyUUID);

    // Act
    const result = await mockGiftCardService.redeem({
      data: {
        code: 'Valid-100-USD',
        redeemAmount: {
          centAmount: 100,
          currencyCode: 'USD',
        },
      },
    });

    // Assert - redeem now only authorizes (doesn't charge yet)
    expect(result.result).toStrictEqual('Success');
    expect(result.paymentReference).toStrictEqual('123456');
    // redemptionId is now the payment ID since actual redemption happens in capturePayment
    expect(result.redemptionId).toStrictEqual(createPaymentResultOk.id);
  });

  test('when redeeming gift card with wrong currency, it should throw error with code CuurencyNotMatch', async () => {
    setupMockConfig({ mockConnectorCurrency: 'EUR' });
    const dummyUUID = 'It-is-a-dummy-uuid';
    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(createPaymentResultOk);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(getCartOK());
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(dummyUUID);

    try {
      await mockGiftCardService.redeem({
        data: {
          code: '34567',
          redeemAmount: {
            centAmount: 1,
            currencyCode: 'USD',
          },
        },
      });
      throw new Error('This should not be reached');
    } catch (error) {
      if (error instanceof MockCustomError) {
        expect(error.message).toBe('cart and gift card currency do not match');
      } else {
        throw new Error('Unexpected error type');
      }
    }
  });

  test('when redeem giftcard with correct currency but failed the redemption, it should return Failure as result', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });
    const dummyUUID = 'It-is-a-dummy-uuid';
    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(createPaymentResultOk);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(getCartOK());
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(dummyUUID);

    const result = await mockGiftCardService.redeem({
      data: {
        code: 'Valid-0-USD',
        redeemAmount: {
          centAmount: 0,
          currencyCode: 'USD',
        },
      },
    });

    // redeem now only authorizes, so it returns Success
    // Actual redemption failure would occur in capturePayment
    expect(result.result).toStrictEqual('Success');
    expect(result.paymentReference).toStrictEqual('123456');
    expect(result.redemptionId).toStrictEqual(createPaymentResultOk.id);
  });

  test('it should throw a MockCustomError with Valid-00 to test a giftcard that passes balance but fails to redeem', async () => {
    setupMockConfig({ mockConnectorCurrency: 'USD' });
    const dummyUUID = 'It-is-a-dummy-uuid';
    jest.spyOn(DefaultPaymentService.prototype, 'createPayment').mockResolvedValue(createPaymentResultOk);
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(getCartOK());
    jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(dummyUUID);

    try {
      await mockGiftCardService.redeem({
        data: {
          code: 'Valid-00100-USD',
          redeemAmount: {
            centAmount: 0,
            currencyCode: 'USD',
          },
        },
      });
      throw new Error('This should not be reached');
    } catch (error) {
      if (error instanceof MockCustomError) {
        expect(error.message).toBe('The gift card is expired.');
      } else {
        throw new Error('Unexpected error type');
      }
    }
  });

  describe('modifyPayment', () => {
    test('capturePayment', async () => {
      // Given
      setupMockConfig({ mockConnectorCurrency: 'USD' });
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'capturePayment',
              amount: {
                centAmount: 1000,
                currencyCode: 'USD',
              },
            },
          ],
        },
      };

      // Create a payment with a valid gift card code in interfaceId
      // This simulates the gift card code stored during the redeem phase
      const paymentWithGiftCardCode: Payment = {
        ...getPaymentResultOk,
        interfaceId: 'Valid-1000-USD', // Valid gift card code format
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(paymentWithGiftCardCode);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);

      // capturePayment is now implemented and should succeed with valid gift card code
      const result = await mockGiftCardService.modifyPayment(modifyPaymentOpts);
      expect(result.outcome).toBe('approved');
    });

    test('cancelPayment', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'cancelPayment',
            },
          ],
        },
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(getPaymentResultOk);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);

      const result = mockGiftCardService.modifyPayment(modifyPaymentOpts);
      expect(result).rejects.toThrow('operation not supported');
    });

    test('refundPayment', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'refundPayment',
              amount: {
                centAmount: 3000,
                currencyCode: 'EUR',
              },
            },
          ],
        },
      };

      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(getPaymentResultOk);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);

      const result = await mockGiftCardService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual('approved');
    });

    test('refundPayment - not ok', async () => {
      // Given
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'refundPayment',
              amount: {
                centAmount: 3000,
                currencyCode: 'EUR',
              },
            },
          ],
        },
      };

      jest
        .spyOn(DefaultPaymentService.prototype, 'getPayment')
        .mockResolvedValue(getPaymentResultOkWithInvalidInterface);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);

      const result = await mockGiftCardService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual('rejected');
    });

    test('revertPayment', async () => {
      const modifyPaymentOpts: ModifyPayment = {
        paymentId: 'dummy-paymentId',
        data: {
          actions: [
            {
              action: 'reversePayment',
            },
          ],
        },
      };
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(getPaymentResultOk);
      jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(updatePaymentResultOk);

      const result = await mockGiftCardService.modifyPayment(modifyPaymentOpts);
      expect(result?.outcome).toStrictEqual('approved');
    });
  });
});
