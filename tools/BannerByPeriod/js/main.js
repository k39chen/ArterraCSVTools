$(document).ready(function() {
  var csv = CSVHelpers.create({
    // define more metadata
    transformRules: function(col, type) {
      var isPeriodColumnId = (/^\d\d\d\d-\d\d-\d\d$/).test(col.columnId) || (/^(\d+)\/(\d+)\/(\d+)$/).test(col.columnId);
      if (isPeriodColumnId) {
        col.isPeriodColumnId = true;
        col.excludeFromOutput = true;
      }
      return col;
    }
  }, (csv) => {
    var $resultsSection = $('.section[data-id="results"]');
    $resultsSection.show();

    setTimeout(() => {
      process(csv);
    }, 1000);
  }, reset);
});
/**
 * This method will be called after the read process
 * is completed.
 *
 * @method process
 * @param csv {CSVData} The CSV data object.
 */
function process(csv) {
  // The transform process here is as follow:
  // 1. Remove any columns that match the period format (e.g. 2019-11-04, 2019/11/04)
  // 2. Insert a PERIOD column as the first column
  // 3. Insert another column at the end, one of PRICE/UNITS/SALES
  // 4. For each period on a row, add an additional row and duplicate non-period data
  // 5. Perform sorting on the resulting rows: banner first, product second, date third
  var lastColName = csv.fileName.match(/PRICE|SALES|UNITS/i) || ['PRICE'];
  csv.addColumn('PERIOD', 0);
  csv.addColumn(lastColName[0], _.size(csv.headers) - 1);

  // it will be helpful to compute the number of period columns
  var periodColumns = [];
  _.each(csv.headers, (col, columnId) => {
    if (col.isPeriodColumnId) {
      periodColumns.push(columnId);
    }
  });
  // we will be re-making the body
  var body = [];
  _.each(csv.body, function(row, rowIndex) {
    // go through each of our period columns and
    // add a corresponding row for each based on this current row
    _.each(periodColumns, (periodColumnId) => {
      var newRow = csv.cloneRow(rowIndex);

      // set the period column of this new row to this column id
      newRow['PERIOD'].outputValue = periodColumnId;

      // set the last column value to this period's value
      newRow[lastColName].outputValue = newRow[periodColumnId].rawValue;

      // commit this row
      body.push(newRow);
    });
  });
  // perform some tiered sorting
  body = _.chain(body)
      // sort by period third
      .sortBy(row => new Date(row['PERIOD'] + ""))
      // sort by product second
      .sortBy(row => row[PRODUCT_DISPLAY_DSC])
      // sort by banner first
      .sortBy(row => row['Banner Group'])
      .value();

  // assign our newly computed CSV body
  csv.body = body;

  // write the modified version of the CSV to the file
  csv.writeToFile(`[GENERATED]_${csv.fileName}`);
}
/**
 * This method will be called when the file input has been reset.
 *
 * @method reset
 */
function reset() {
  var $resultsSection = $('.section[data-id="results"]');

  // hide the results section
  $resultsSection.hide();
}
