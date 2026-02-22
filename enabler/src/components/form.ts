import {
  Amount,
  BalanceType,
  BaseOptions,
  GiftCardComponent,
  GiftCardOptions,
  PaymentResult,
} from '../providers/definitions';
import { BaseComponentBuilder, DefaultComponent } from './definitions';
import {
  addFormFieldsEventListeners,
  fieldIds,
  getErrorCode,
  getInput,
  hideError,
  showError,
} from './utils';
import inputFieldStyles from '../style/inputField.module.scss';
import I18n from '../i18n';
import { translations } from '../i18n/translations';

export class FormBuilder extends BaseComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(baseOptions);
  }

  build(config: GiftCardOptions): GiftCardComponent {
    return new FormComponent({
      giftcardOptions: config,
      baseOptions: this.baseOptions,
    });
  }
}

export class FormComponent extends DefaultComponent {
  protected i18n: I18n;
  private currentBalance: BalanceType | null = null;

  constructor(opts: { giftcardOptions: GiftCardOptions; baseOptions: BaseOptions }) {
    super(opts);
    this.i18n = new I18n(translations);
    this.balance = this.balance.bind(this);
    this.submit = this.submit.bind(this);
  }

  async balance(): Promise<BalanceType> {
    try {
      const giftCardCode = getInput(fieldIds.code).value.replace(/\s/g, '');
      const pin = getInput(fieldIds.pin).value;
      console.log('Checking balance for card:', giftCardCode);
      const requestBody = {
        code: "Valid-600000000-USD",
        securityCode: pin
      }
      const fetchBalanceURL = this.baseOptions.processorUrl.endsWith('/')
        ? `${this.baseOptions.processorUrl}balance`
        : `${this.baseOptions.processorUrl}/balance`;
      const response = await fetch(fetchBalanceURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.baseOptions.sessionId,
        },
        body: JSON.stringify(requestBody)
      });

      const jsonResponse = await response.json();
      if (!jsonResponse?.status?.state) {
        throw jsonResponse;
      }

      const errorCode = getErrorCode(jsonResponse);
      if (errorCode) {
        const translatedMessage = this.i18n.keyExists(`error${errorCode}`, this.baseOptions.locale)
          ? this.i18n.translate(`error${errorCode}`, this.baseOptions.locale)
          : this.i18n.translate('errorGenericError', this.baseOptions.locale);
        showError(fieldIds.code, translatedMessage);
      } else {
        hideError(fieldIds.code);
      }

      return jsonResponse;
    } catch (err) {
      showError(fieldIds.code, this.i18n.translate('errorGenericError', this.baseOptions.locale));
      this.baseOptions.onError(err);
    }
  }

  async submit(params: { amount?: Amount }): Promise<void> {
    try {
      const giftCardCode = getInput(fieldIds.code).value.replace(/\s/g, '');
      console.log(giftCardCode)
      const pin = getInput(fieldIds.pin).value;
      const requestBody = {
        redeemAmount: params.amount,
        code: "Valid-600000000-USD",
        securityCode: pin,
      };
      console.log('Submitting redeem for card:', requestBody);
      const requestRedeemURL = this.baseOptions.processorUrl.endsWith('/')
        ? `${this.baseOptions.processorUrl}redeem`
        : `${this.baseOptions.processorUrl}/redeem`;

      const response = await fetch(requestRedeemURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.baseOptions.sessionId,
        },
        body: JSON.stringify(requestBody),
      });

      const redeemResult = await response.json();

      if (!response.ok) {
        throw redeemResult;
      }

      const paymentResult: PaymentResult = {
        isSuccess: redeemResult.isSuccess,
        paymentReference: redeemResult.paymentReference,
      };

      this.baseOptions.onComplete(paymentResult);
    } catch (err) {
      this.baseOptions.onError(err);
    }
    return;
  }

  mount(selector: string): void {
    document.querySelector(selector).insertAdjacentHTML('afterbegin', this._getField());
    addFormFieldsEventListeners(this.giftcardOptions);

    // Add event listeners for new UI elements
    const checkbox = getInput(fieldIds.checkbox);
    checkbox.addEventListener('change', () => this._handleCheckboxChange());

    const cardNumberInput = getInput(fieldIds.code);
    cardNumberInput.addEventListener('input', () => this._handleCardNumberInput());

    const pinInput = getInput(fieldIds.pin);
    pinInput.addEventListener('input', () => this._handlePinInput());

    const pinToggleButton = document.getElementById(fieldIds.pinToggle);
    pinToggleButton.addEventListener('click', () => this._handlePinToggleVisibility());

    const infoIcon = document.getElementById(fieldIds.infoIcon);
    infoIcon.addEventListener('click', () => this._handleInfoIconClick());

    const loadBalanceButton = document.getElementById(fieldIds.loadBalance);
    loadBalanceButton.addEventListener('click', () => this._handleLoadBalance());

    const amountInput = getInput(fieldIds.amount);
    amountInput.addEventListener('input', () => this._handleAmountChange());

    const applyButton = document.getElementById(fieldIds.apply);
    applyButton.addEventListener('click', () => this._handleApply());

    this.giftcardOptions
      ?.onGiftCardReady?.()
      .then()
      .catch((err) => {
        this.baseOptions.onError(err);
        throw err;
      });
  }

  private _handleCheckboxChange(): void {
    const checkbox = getInput(fieldIds.checkbox);
    const formContent = document.getElementById(fieldIds.formContent);

    if (checkbox.checked) {
      formContent.classList.remove(inputFieldStyles.hidden);
    } else {
      formContent.classList.add(inputFieldStyles.hidden);
    }
  }

  private _handleCardNumberInput(): void {
    const input = getInput(fieldIds.code);
    // Filter to digits only, max 16
    input.value = input.value.replace(/\D/g, '').slice(0, 16);
    hideError(fieldIds.code);
  }

  private _handlePinInput(): void {
    const input = getInput(fieldIds.pin);
    // Filter to digits only, max 4
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
    hideError(fieldIds.pin);
  }

  private _handlePinToggleVisibility(): void {
    const input = getInput(fieldIds.pin);
    const button = document.getElementById(fieldIds.pinToggle);

    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = this.i18n.translate('hideToggleText', this.baseOptions.locale);
    } else {
      input.type = 'password';
      button.textContent = this.i18n.translate('showToggleText', this.baseOptions.locale);
    }
  }

  private _validateLoadBalance(): boolean {
    return true;
/*    const cardNumber = getInput(fieldIds.code).value;
    const pin = getInput(fieldIds.pin).value;
    let isValid = true;

    // Validate card number (must be exactly 16 digits)
    if (cardNumber.length !== 16) {
      showError(fieldIds.code, this.i18n.translate('errorInvalidCardNumber', this.baseOptions.locale));
      isValid = false;
    } else {
      hideError(fieldIds.code);
    }

    // Validate PIN (must be exactly 4 digits)
    if (pin.length !== 4) {
      showError(fieldIds.pin, this.i18n.translate('errorInvalidPin', this.baseOptions.locale));
      isValid = false;
    } else {
      hideError(fieldIds.pin);
    }

    return isValid;*/
  }

  private _handleInfoIconClick(): void {
    const tooltip = document.getElementById(fieldIds.infoTooltip);
    tooltip.classList.toggle(inputFieldStyles.hidden);
  }

  private async _handleLoadBalance(): Promise<void> {
    // Validate inputs before making API call
    if (!this._validateLoadBalance()) {
      return;
    }

    const button = document.getElementById(fieldIds.loadBalance) as HTMLButtonElement;
    const originalText = button.textContent;
    console.log(originalText)
    button.disabled = true;
    button.textContent = this.i18n.translate('loadingText', this.baseOptions.locale);

    try {
      const balance = await this.balance();
      this.currentBalance = balance;
      this._showBalanceDisplay(balance);
/*      if (balance && balance.status.state === 'Valid' && balance.amount) {
        this.currentBalance = balance;
        this._showBalanceDisplay(balance);
      }*/
    } catch (error) {
      // Error already handled by balance() method
    } finally {
      button.disabled = false;
      button.textContent = "originalText";
    }
  }

  private _showBalanceDisplay(balance: BalanceType): void {
    const displayElement = document.getElementById(fieldIds.balanceDisplay);
    const amountElement = document.getElementById(fieldIds.balanceAmount);
    const amountInput = getInput(fieldIds.amount) as HTMLInputElement;

    // Format currency (centAmount to dollars)
    const dollars = balance.amount.centAmount / 100;
    const formatted = `$${dollars.toFixed(2)}`;

    // Update UI
    amountElement.textContent = formatted;
    displayElement.classList.remove(inputFieldStyles.hidden);
    amountInput.disabled = false;
  }

  private _handleAmountChange(): void {
    const amountInput = getInput(fieldIds.amount) as HTMLInputElement;
    const applyButton = document.getElementById(fieldIds.apply) as HTMLButtonElement;
    const value = parseFloat(amountInput.value);

    // Hide any previous errors
    hideError(fieldIds.amount);

    // Validate amount
    if (isNaN(value) || value <= 0) {
      applyButton.disabled = true;
      return;
    }

    // Check if amount exceeds balance
    if (this.currentBalance && this.currentBalance.amount) {
      const maxAmount = this.currentBalance.amount.centAmount / 100;
      if (value > maxAmount) {
        showError(fieldIds.amount, this.i18n.translate('errorAmountExceedsBalance', this.baseOptions.locale));
        applyButton.disabled = true;
        return;
      }
    }

    applyButton.disabled = false;
  }

  private async _handleApply(): Promise<void> {
    const amountInput = getInput(fieldIds.amount) as HTMLInputElement;
    const applyButton = document.getElementById(fieldIds.apply) as HTMLButtonElement;

    const dollars = parseFloat(amountInput.value);
    if (isNaN(dollars) || dollars <= 0) {
      showError(fieldIds.amount, this.i18n.translate('errorInvalidAmount', this.baseOptions.locale));
      return;
    }

    const centAmount = Math.round(dollars * 100);
    const amount = {
      centAmount,
      currencyCode: this.currentBalance?.amount?.currencyCode || 'USD',
    };

    const originalText = applyButton.textContent;
    applyButton.disabled = true;
    applyButton.textContent = this.i18n.translate('processingText', this.baseOptions.locale);

    try {
      await this.submit({ amount });
    } finally {
      applyButton.disabled = false;
      applyButton.textContent = originalText;
    }
  }

  private _getField() {
    return `
        <div class="${inputFieldStyles.wrapper}">
          <div class="${inputFieldStyles.paymentForm}">

            <!-- Checkbox (checked by default so SDK can see input field) -->
            <div class="${inputFieldStyles.checkboxContainer}">
              <input type="checkbox" id="${fieldIds.checkbox}" checked />
              <label for="${fieldIds.checkbox}">${this.i18n.translate('redeemCheckboxLabel', this.baseOptions.locale)}</label>
            </div>

            <!-- Divider -->
            <hr class="${inputFieldStyles.divider}" />

            <!-- Form content (visible by default since checkbox is checked) -->
            <div id="${fieldIds.formContent}" class="${inputFieldStyles.formContent}">

              <!-- Section header with info icon -->
              <div class="${inputFieldStyles.sectionHeader}">
                <h3>${this.i18n.translate('balanceHeaderText', this.baseOptions.locale)}</h3>
                <button type="button" class="${inputFieldStyles.infoIcon}" id="${fieldIds.infoIcon}" aria-label="More information">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                  </svg>
                </button>
              </div>

              <!-- Info tooltip (hidden by default) -->
              <div id="${fieldIds.infoTooltip}" class="${inputFieldStyles.infoTooltip} ${inputFieldStyles.hidden}">
                <p>${this.i18n.translate('infoTooltipContent', this.baseOptions.locale)}</p>
              </div>

              <!-- Help text with Customer Care link -->
              <div class="${inputFieldStyles.helpText}">
                ${this.i18n.translate('helpTextWithoutDigits', this.baseOptions.locale)}
                <a href="https://help.example.com" target="_blank" rel="noopener">${this.i18n.translate('customerCareLink', this.baseOptions.locale)}</a>.
              </div>

              <!-- Card Number and PIN input row -->
              <div class="${inputFieldStyles.inputRow}">
                <!-- Card Number Input (16 digits, plain text) -->
                <div class="${inputFieldStyles.inputContainer} ${inputFieldStyles.cardNumberInput}">
                  <input
                    class="${inputFieldStyles.inputField}"
                    type="text"
                    id="${fieldIds.code}"
                    name="giftCardCode"
                    value=""
                    maxlength="16"
                    placeholder="${this.i18n.translate('cardNumberPlaceholder', this.baseOptions.locale)}"
                    aria-describedby="${fieldIds.codeError}"
                    aria-invalid="false"
                  />
                  <div
                    id="${fieldIds.codeError}"
                    class="${inputFieldStyles.errorField} ${inputFieldStyles.hidden}"
                    role="alert"
                    aria-live="polite"
                    aria-hidden="true"
                  ></div>
                </div>

                <!-- PIN Group (4 digits, password with toggle) -->
                <div class="${inputFieldStyles.inputContainer} ${inputFieldStyles.pinGroup}">
                  <input
                    class="${inputFieldStyles.inputField}"
                    type="password"
                    id="${fieldIds.pin}"
                    name="giftCardPin"
                    value=""
                    maxlength="4"
                    placeholder="${this.i18n.translate('pinPlaceholder', this.baseOptions.locale)}"
                    aria-describedby="${fieldIds.pinError}"
                    aria-invalid="false"
                  />
                  <button
                    type="button"
                    class="${inputFieldStyles.showButton}"
                    id="${fieldIds.pinToggle}"
                    aria-label="Toggle PIN visibility"
                  >
                    ${this.i18n.translate('showToggleText', this.baseOptions.locale)}
                  </button>
                  <div
                    id="${fieldIds.pinError}"
                    class="${inputFieldStyles.errorField} ${inputFieldStyles.hidden}"
                    role="alert"
                    aria-live="polite"
                    aria-hidden="true"
                  ></div>
                </div>

                <!-- Load Balance Button -->
                <button
                  type="button"
                  id="${fieldIds.loadBalance}"
                  class="${inputFieldStyles.loadBalanceButton}"
                >
                  ${this.i18n.translate('loadBalanceButton', this.baseOptions.locale)}
                </button>
              </div>

              <!-- Balance display (hidden until balance loaded) -->
              <div id="${fieldIds.balanceDisplay}" class="${inputFieldStyles.balanceDisplay} ${inputFieldStyles.hidden}">
                <p class="${inputFieldStyles.balanceText}">
                  ${this.i18n.translate('balanceDisplayPrefix', this.baseOptions.locale)} <strong id="${fieldIds.balanceAmount}">$0.00</strong>. ${this.i18n.translate('balanceDisplaySuffix', this.baseOptions.locale)}
                </p>
              </div>

              <!-- Amount input with $ prefix -->
              <div class="${inputFieldStyles.inputContainer} ${inputFieldStyles.amountInput}">
                <span class="${inputFieldStyles.currencyPrefix}">$</span>
                <input
                  class="${inputFieldStyles.inputField}"
                  type="number"
                  id="${fieldIds.amount}"
                  name="giftCardAmount"
                  value=""
                  min="0"
                  step="0.01"
                  disabled
                  aria-describedby="${fieldIds.amountError}"
                  aria-invalid="false"
                />
                <div
                  id="${fieldIds.amountError}"
                  class="${inputFieldStyles.errorField} ${inputFieldStyles.hidden}"
                  role="alert"
                  aria-live="polite"
                  aria-hidden="true"
                ></div>
              </div>

              <!-- Apply button -->
              <button
                type="button"
                id="${fieldIds.apply}"
                class="${inputFieldStyles.applyButton}"
                disabled
              >
                ${this.i18n.translate('applyButton', this.baseOptions.locale)}
              </button>

            </div>
          </div>
        </div>
      `;
  }
}
