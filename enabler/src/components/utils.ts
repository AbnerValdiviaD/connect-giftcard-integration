import { GiftCardOptions } from '../providers/definitions';
import inputFieldStyles from '../style/inputField.module.scss';

export const getInput = (field: string) => document.querySelector(`#${field}`) as HTMLInputElement;

export const showError = (field: string, textContent: string) => {
  const input = getInput(field);
  input.parentElement.classList.add(inputFieldStyles.error);
  const errorElement = input.parentElement.querySelector(`#${field} + .${inputFieldStyles.errorField}`);
  errorElement.textContent = textContent;
  errorElement.classList.remove(inputFieldStyles.hidden);
};

export const hideError = (field: string) => {
  const input = getInput(field);
  input.parentElement.classList.remove(inputFieldStyles.error);
  const errorElement = input.parentElement.querySelector(`#${field} + .${inputFieldStyles.errorField}`);
  errorElement.textContent = '';
  errorElement.classList.add(inputFieldStyles.hidden);
};

export const fieldIds = {
  code: 'giftcard-code',
  pin: 'giftcard-pin',
  amount: 'giftcard-amount',
  pinToggle: 'giftcard-pin-toggle',
  loadBalance: 'giftcard-load-balance',
  apply: 'giftcard-apply',
  checkbox: 'giftcard-redeem-checkbox',
  balanceDisplay: 'balance-display',
  formContent: 'giftcard-form-content',
  infoIcon: 'giftcard-info-icon',
  infoTooltip: 'giftcard-info-tooltip',
  balanceAmount: 'balance-amount',
  codeError: 'giftcard-code-error',
  pinError: 'giftcard-pin-error',
  amountError: 'giftcard-amount-error',
};

const handleChangeEvent = (field: string, onValueChange?: (hasValue: boolean) => Promise<void>) => {
  const input = getInput(field);
  if (input) {
    input.addEventListener('input', () => {
      onValueChange?.(input.value !== '');
    });
  }

  input.addEventListener('focusout', () => {
    input.value.length > 0
      ? input.parentElement.classList.add(inputFieldStyles.containValue)
      : input.parentElement.classList.remove(inputFieldStyles.containValue);
  });
};

export const addFormFieldsEventListeners = (giftcardOptions: GiftCardOptions) => {
  handleChangeEvent(fieldIds.code, giftcardOptions?.onValueChange);
  handleChangeEvent(fieldIds.code, async () => hideError(fieldIds.code));
  handleChangeEvent(fieldIds.pin, async () => hideError(fieldIds.pin));
  handleEnter(fieldIds.code, giftcardOptions?.onEnter);
  handleEnter(fieldIds.pin, giftcardOptions?.onEnter);
};

type Res = {
  status: {
    state: string;
    errors?: {
      code: string;
      message: string;
    }[];
  };
  amount?: {
    centAmount: number;
    currencyCode: string;
  };
};

export const getErrorCode = (res: Res): string | null =>
  res.status.state !== 'Valid' ? res.status.errors?.[0].code || 'GenericError' : null;

export const handleEnter = (field: string, callback: (e: Event) => void) => {
  getInput(field).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      callback(e);
    }
  });
};
