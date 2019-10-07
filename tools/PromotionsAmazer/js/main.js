window.VALUE_REQUIRED_PROMO_CODES = ["LO", "AM"];
window.PROMOTION_CODES = {};

$(document).ready(function() {
  var csv = CSVHelpers.create({
    transformRules: (col, type) => {
      if (type === 'body' && col.columnId === 'Promotions') {
        col.parts = getPromotionCodes(col.rawValue);
      }
      _.each(window.VALUE_REQUIRED_PROMO_CODES, (code) => {
        if (col.columnId === `${code}_VALUE`) {
          col.isValueColumn = true;
        }
      });
      return col;
    }
  }, process, reset);

  $("#generateOutputBtn").click(function() {
    generateOutput(csv.csv);
  });
});
/**
 * This method will be called after the read process
 * is completed.
 *
 * @method process
 * @param csv {CSVData} The CSV data object.
 */
function process(csv) {
  console.log(csv.headers);
  console.log(csv.body);

  // we're going to collect a list of all the potential promotion codes.
  _.each(csv.body, (row, rowIndex) => {
    _.each(row && row['Promotions'] && row['Promotions'].parts, (code) => {
      window.PROMOTION_CODES[code] = true;
    });
  });
  window.PROMOTION_CODES = _.keys(window.PROMOTION_CODES);
  window.PROMOTION_CODES = _.sortBy(window.PROMOTION_CODES, code => code);

  // render the codes
  renderPromotionCodes(window.PROMOTION_CODES);

  $('.section[data-id="promotion-codes"]').show();
}
/**
 * This method will generate the output, given the list of vetted promotion codes.
 *
 * @method generateOutput
 * @param csv {CSVData} The CSV data object.
 */
function generateOutput(csv) {
  var codes = {};

  // scrape the user selected list of codes
  $('#codes > .code-item').each(function() {
    codes[$(this).attr('data-code')] = true;
  });
  // try to add any _VALUE related columns if necessary
  _.each(window.VALUE_REQUIRED_PROMO_CODES, (valueRequiredCode) => {
    if (!_.isUndefined(valueRequiredCode)) {
      codes[`${valueRequiredCode}_VALUE`] = true;
    }
  });
  // sort alphabetically if possible
  codes = _.keys(codes);
  codes = _.sortBy(codes, code => code);

  // go through each of our codes add each as a column at the end of the table
  _.each(codes, (code, codeIndex) => {
    csv.addColumn(code, _.size(csv.headers) - 1 + codeIndex);
  });
  // go through each row and fill the column data with the appropriate value
  _.each(csv.body, (row, rowIndex) => {
    _.each(codes, (code) => {
      if (!row || !row['Promotions'] || !row['Promotions'].parts) return;

      row[code].outputValue = row['Promotions'].parts.includes(code) ? '1' : '0';

      if (row[code].isValueColumn) {
        row[code].outputValue = getPromotionPrice(row['Promotions'].parts);
      }
    });
  });
  // write the modified version of the CSV to the file
  csv.writeToFile(`[GENERATED]_${csv.fileName}`);

  $('.section[data-id="results"]').show();
}
/**
 * This method will be called when the file input has been reset.
 *
 * @method reset
 */
function reset() {
  $('.section[data-id="promotion-codes"]').hide();
  $('.section[data-id="results"]').hide();
}
/**
 * This method will render the provided list of promotion codes.
 *
 * @method renderPromotionCodes
 * @param codes {Array} The list of promotion codes.
 */
function renderPromotionCodes(codes) {
  var $codes = $('#codes');

  $codes.empty();

  _.each(codes, (code) => {
    var $code = $(`
      <div class="code-item" data-code="${code}">
        <span>${code}</span>
        <a class="fa fa-times remove-btn"></a>
      </div>
    `);
    $code.click(function() {
      $(this).remove();
    });
    $codes.append($code);
  });
}
/**
 * This method will take a promotion cell and scrape
 * all potential promotion codes.
 *
 * @method getPromotionCodes
 * @param cellValue {String} The raw cell value.
 * @return {Array} The list of promotion codes.
 */
function getPromotionCodes(cellValue) {
  if (!cellValue) return [];

  cellValue = JSON.parse(JSON.stringify(cellValue));
  cellValue = cellValue.split(" ");
  cellValue = _.reject(cellValue, function(code) {
      // reject any values that are empty...
      if (_.isEmpty($.trim(code))) return true;

      // reject any values that are a number
      if (!_.isNaN(parseFloat(code.replace(/\$/gi, "")))) return true;

      // reject any values that contain a lowercase character
      // (this is currently our best way to handle unwanted values)
      // if (containsLowerCase(code)) return true;

      // reject the edge case for this character
      if (code === "&") return true;

      // otherwise, this is a valid promo-code
      return false;
  });
  // we also don't care about codes that are post-fixed with minuses.
  // we will group these together with the unpost-fixed versions
  cellValue = _.map(cellValue, function(code) {
      return code.replace(/\-$/, "");
  });
  return cellValue || [];
}
/**
 * This method will determine the price for a given promotion.
 *
 * @method getPromotionPrice
 * @param parts {String} The parts of this promotion.
 * @return {Number} The promotion price.
 */
function getPromotionPrice(parts) {
  for (var i=0; i<parts.length; i++) {
      price = parseFloat(parts[i].replace(/\$/gi, ""));
      if (!_.isNaN(price)) {
          return price;
      }
  }
  return null;
}
