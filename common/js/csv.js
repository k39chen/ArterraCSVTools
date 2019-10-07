/**
 * This is our prototypal CSV data object which
 * can perform read/write and manipulation operations.
 *
 * @class CSVData
 */
function CSVData() {
  this.fileName = null;
  this.fileObject = null;
  this.rawData = null;
  this.fileStats = {
    Bytes: 0,
    Columns: 0,
    Rows: 0
  };
  this.downloadStats = {
    Bytes: 0,
    Columns: 0,
    Rows: 0
  };

  // NOTE: any column that contains excludeFromOutput
  // will not be in the final output

  // optionally provided set of transform rules. This will
  // be applied to both the header and the body.
  //
  // e.g.
  // function(column, type) {
  //   // type can be either header or body for more distinction
  //   if (column.columnId === 'COLUMN 1') {
  //     return column.rawValue.split(' ');
  //   }
  //   return column;
  // }
  //
  this.transformRules = null;

  // this will store the headers of this CSV file
  //
  // e.g.
  // {
  //   "COLUMN 1": {
  //     columnId: "COLUMN 1",
  //     ordinal: 0
  //   },
  //   "COLUMN 2": {
  //     columnId: "COLUMN 2"
  //     ordinal: 1,
  //   }
  // }
  //
  this.headers = {};

  // this store the rows of this CSV file. Each item in this
  // body will have an item format
  //
  // e.g.
  // [
  //   {
  //     "COLUMN 1": {
  //       columnId: "COLUMN 1",
  //       rawValue: "col 1 value",
  //       outputValue: "col 10 value"
  //     },
  //     "COLUMN 2": {
  //       columnId: "COLUMN 2",
  //       rawValue: "col 2 value",
  //       outputValue: "col 20 value"
  //     }
  //   }
  // ]
  this.body = [];
}
/**
 * This method will add a column at the desired ordinal.
 * Other columns with the same or greater ordinal will
 * be incremented accordingly.
 *
 * @memberof CSVData
 * @method addColumn
 * @param columnId {String} The column id.
 * @param ordinal {Number} The target ordinal.
 */
CSVData.prototype.addColumn = function(columnId, ordinal) {
  _.each(this.headers, (col, columnId) => {
    if (col.ordinal >= ordinal) {
      col.ordinal++;
    }
    this.headers[columnId] = col;
  });
  this.headers[columnId] = {
    columnId: columnId,
    ordinal: ordinal
  };
  if (_.isFunction(this.transformRules)) {
    this.headers[columnId] = this.transformRules(this.headers[columnId], 'header');
  }
  _.each(this.body, (row, rowIndex) => {
    row[columnId] = {
      columnId: columnId,
      rawValue: '',
      outputValue: ''
    };
    // compute a transformed value if applicable
    if (_.isFunction(this.transformRules)) {
      row[columnId] = this.transformRules(row[columnId], 'body');
    }
  })
};
/**
 * This method will clone a given row and return a reference to it.
 *
 * @memberof CSVData
 * @method cloneRow
 * @param rowIndex {Number} The index of the row that we are cloning.
 * @return {Object} The reference to the row that we just cloned.
 */
CSVData.prototype.cloneRow = function(rowIndex) {
  var row = JSON.parse(JSON.stringify(this.body[rowIndex]));
  return row;
};
/**
 * This method will read from a file, given an input
 * file object.
 *
 * @memberof CSVData
 * @method readFromFile
 * @param file {File} The file object.
 * @param onChangeCb {Function} An optional callback function for when a file is selected.
 */
CSVData.prototype.readFromFile = function(file, onChangeCb) {
  // don't continue if the provided doesn't exist
  if (!file) {
    Logger.write(Logger.Types.Error, "Unable to read file.")
    return;
  }
  var Reader = new FileReader();
  Logger.write(Logger.Types.Info, "Reading file <b>" + file.name + "</b>...");

  // set the file object
  this.fileObject = file;
  this.fileName = file.name;

  // use the file reader to parse the file
  Reader.readAsText(file, "ISO-8859-1");
  Reader.onload = (function(ev) {
    // set our reference to the raw data
    this.rawData = ev.target.result;

    // we will now process this data with the assumption
    // that this will be a CSV format file
    this.setCSVData(this.rawData);

    // try to print the stats to the DOM
    this.printFileStats();

    // call our optional callback method
    if (_.isFunction(onChangeCb)) {
      onChangeCb(this);
    }
  }).bind(this);
};
/**
 * This method will write the contents of this CSV object
 * to the specified file.
 *
 * @memberOf CSVData
 * @method writeToFile
 * @param outputFileName {String} The output file name.
 */
CSVData.prototype.writeToFile = function(outputFileName) {
  Logger.write(Logger.Types.Info, 'Constructing file text. This will take a while');

  // helper method to convert CSV header and body value to raw text
  var makeTextFileData = () => {
    var result = [];

    var headers = _.chain(this.headers)
      .toArray()
      .sortBy(_.property('ordinal'))
      .reject(col => col.excludeFromOutput)
      .map(col => col.columnId)
      .value();
    result.push(headers);

    _.each(this.body, (row, rowIndex) => {
      var rowData = _.chain(row)
        .toArray()
        .sortBy(col => this.headers[col.columnId].ordinal)
        .reject(col => this.headers[col.columnId].excludeFromOutput)
        .map(col => col.outputValue)
        .value();
      result.push(rowData);
    });
    // fill the textarea with the copiable version of the results
    var text = '';
    _.each(result, function(row, rowIndex) {
      if (!_.isEqual(rowIndex, 0)) {
        text += '\n';
      }
      _.each(row, function(col, colIndex) {
        if (!_.isEqual(colIndex, 0)) {
          text += ','
        }
        text += col;
      });
    });

    this.downloadStats = {
      Bytes: text.length,
      Columns: result && result[0].length,
      Rows: result.length
    };

    return text;
  };
  // helper method to build a text file blob given raw string
  var makeTextFile = function(text) {
    // add the BOM header to support UTF-8 characters
    var BOM = '\uFEFF';
    text = BOM + text;

    // create the file blob
    var data = new Blob([text], {
      encoding: 'UTF-8',
      type: 'text/csv;charset=utf-8'
    });
    // create the text file
    var textFile = window.URL.createObjectURL(data);

    // returns a URL you can use as a href
    return textFile;
  };
  // since this is a large operation, perform this asyncronously
  setTimeout(() => {
    var text = makeTextFileData();

    // print our download stats
    this.printDownloadStats();

    Logger.write(Logger.Types.Info, 'Making text file.');

    var blobURL = makeTextFile(text);

    Logger.write(Logger.Types.Info, 'Creating download link for blob URL: <b>' + blobURL + '</b>');

    var $a = $('<a />')
      .text(outputFileName)
      .attr('download', outputFileName)
      .attr('href', blobURL)
      .appendTo($('#resultsLink'));
  }, 100);
};
/**
 * This method will parse the raw file data.
 *
 * @memberof CSVData
 * @method setCSVData
 * @param rawData {String} The raw data.
 */
CSVData.prototype.setCSVData = function(rawData) {
  var allTextLines = rawData.split(/\r\n|\n/);
  var lines = [];
  for (var i=0; i<allTextLines.length; i++) {
      var data = allTextLines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
      var tarr = [];
      for (var j=0; j<data.length; j++) {
          tarr.push(data[j]);
      }
      lines.push(tarr);
  }
  // set our basic stats
  this.fileStats = {
    Bytes: rawData.length,
    Columns: lines && lines[0].length,
    Rows: lines.length
  };
  // initialize our CSV header (always assumed to be the first row)
  var headers = {};
  var columnOrdinals = [];
  _.each(lines && lines[0], (columnId, columnIndex) => {
    if (!_.isUndefined(headers[columnId])) {
      Logger.write(Logger.Types.Warning, 'Duplicate header column detected', columnId, headers[columnId].ordinal, columnIndex);
    }
    headers[columnId] = {
      columnId: columnId,
      ordinal: columnIndex
    }
    // compute a transformed value if applicable
    if (_.isFunction(this.transformRules)) {
      headers[columnId] = this.transformRules(headers[columnId], 'header');
    }
    columnOrdinals[columnIndex] = columnId;
  });
  // initialize our CSV body
  var body = [];
  _.each(lines && lines.slice(1), (row, rowIndex) => {
    var rowData = {};

    // go through each of the columns in this row and construct acccordingly
    _.each(row, (columnValue, columnIndex) => {
      var columnId = columnOrdinals[columnIndex];
      rowData[columnId] = {
        columnId: columnId,
        rawValue: columnValue,
        outputValue: columnValue
      };
      // compute a transformed value if applicable
      if (_.isFunction(this.transformRules)) {
        rowData[columnId] = this.transformRules(rowData[columnId], 'body');
      }
    });
    body.push(rowData);
  });
  // set our headers and body
  this.headers = headers;
  this.body = body;
};
/**
 * This method will set the transform rules.
 *
 * @memberof CSVData
 * @method setTransformRules
 * @param transformRules {Function} The transform rules.
 */
CSVData.prototype.setTransformRules = function(transformRules) {
  this.transformRules = transformRules;
};
/**
 * This method will print the file stats.
 *
 * @memberof CSVData
 * @method printFileStats
 */
CSVData.prototype.printFileStats = function() {
  var $stats = $('#fileStats');

  Logger.write(Logger.Types.Info, this.fileStats);

  // if this element doesn't exist, then don't append
  // the stats to the DOM.
  if ($stats.length === 0) return;

  // otherwise, report the stats in the DOM
  $stats.empty();
  _.each(this.fileStats, function(value, key) {
    var $field = $(`
      <div class='field'>
        <span class='label'>${key}</span>
        <span class='value'>${value}</span>
      </div>
    `);
    $field.appendTo($stats);
  });
};
/**
 * This method will print the download stats.
 *
 * @memberof CSVData
 * @method printDownloadStats
 */
CSVData.prototype.printDownloadStats = function() {
  var $stats = $('#downloadStats');

  Logger.write(Logger.Types.Info, this.downloadStats);

  // if this element doesn't exist, then don't append
  // the stats to the DOM.
  if ($stats.length === 0) return;

  // otherwise, report the stats in the DOM
  $stats.empty();
  _.each(this.downloadStats, function(value, key) {
    var $field = $(`
      <div class='field'>
        <span class='label'>${key}</span>
        <span class='value'>${value}</span>
      </div>
    `);
    $field.appendTo($stats);
  });
};
/**
 * This method will clear any printed stats.
 *
 * @memberof CSVData
 * @method clearStats
 */
CSVData.prototype.clearStats = function() {
  $('#fileStats').empty();
  $('#downloadStats').empty();
}
/**
 * This is a set of statically available CSV helpers.
 *
 * @class CSVHelpers
 */
if (!window.CSVHelpers) {
  window.CSVHelpers = {
    /**
     * This method will embed a CSV helper file input element
     * at the provided target element.
     *
     * This requires that an element with the id `fileUpload` exists on the page.
     *
     * @method create
     * @param params {Object} Any additional parameters.
     * @param onChangeCb {Function} An optional callback function for when a file is selected.
     * @param onResetCb {Function} An optional callback function for when we wish to select a new file.
     * @return {Object} The newly added file input element along with an associated CSV reference.
     */
    create: function(params, onChangeCb, onResetCb) {
      var csv = new CSVData();
      var $el = $('#fileUpload');
      var $selectButton = $('<button id="selectFileInput">Select File</button>');
      var $fileName = $('<span id="fileName"></span>');
      var $input = $('<input type="file" hidden />');
      var $resetButton = $('<button id="selectFileInput">Reset</button>');

      // provide appropriate default parameter values
      params = _.defaults(params || {}, {
        transformRules: null
      });
      // set transform rules if provided.
      if (_.isFunction(params.transformRules)) {
        csv.setTransformRules(params.transformRules);
      }
      // add the elements to the target
      $el.html('');
      $el.append(
        $selectButton,
        $fileName,
        $input,
        $resetButton
      );
      // allow this element to be able to have a reference to the CSV object
      $el.data('csv', csv);

      // set the initial element visibility
      $selectButton.show();
      $fileName.hide();
      $resetButton.hide();

      // select a file and update element visibility accordingly
      $selectButton.click(function() {
        $input.trigger('click');
      });
      // read from the file and update element visibility accordingly
      $input.change(function() {
        var input = $(this).get(0);
        var inputFile = input && input.files[0];

        // set the file name
        if (!!inputFile) {
          $fileName.html(inputFile.name);
        }
        // attempt to read from the file
        csv.readFromFile(inputFile, onChangeCb);

        // update the element visibility
        $selectButton.hide();
        $fileName.show();
        $resetButton.show();
      });
      // reset the input and update element visibility accordingly
      $resetButton.click(function() {
        $input.val('');

        // update the element visibility
        $selectButton.show();
        $fileName.hide();
        $resetButton.hide();

        // clear any visible stats
        csv.clearStats();

        // call our optional callback method
        if (_.isFunction(onResetCb)) {
          onResetCb(csv);
        }
      });

      return { $input: $input, csv: csv  };
    }
  };
}
