$(document).ready(function() {
    var Reader = new FileReader();

    $("#input-file").change(function() {
        var input = $(this).get(0);
        var inputFile = input && input.files[0];

        addMessage("Logging for " + inputFile.name, true);

        addMessage("Reading file <b>" + inputFile.name + "</b>...");

        if (!inputFile) {
            addMessage("Unable to read file.")
            return;
        }

        Reader.readAsText(inputFile, "ISO-8859-1");
        Reader.onload = function(ev) {
            process(inputFile, ev.target.result);
        };
    });
    var process = function(fileData, text) {
        var csv = getCsvData(text);
        var fileName = fileData.name;

        addMessage("Successfully read file <b>" + fileName + "</b>. Dimensions: <b>" + csv[0].length + " x " + csv.length + "</b>");

        var lastColName = fileName.match(/PRICE|SALES|UNITS/i) || ["PRICE"];

        lastColName = lastColName[0];

        // attempt to generate the result
        var result = generateResult(csv, lastColName);
        
        // if we failed to generate the result, then abort
        if (_.isNull(result)) return;

        // attempt to save to a file
        saveToFile(fileName, result);
    };
    var getCsvData = function(csv) {
        var allTextLines = csv.split(/\r\n|\n/);
        var lines = [];
        for (var i=0; i<allTextLines.length; i++) {
            var data = allTextLines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
            var tarr = [];
            for (var j=0; j<data.length; j++) {
                tarr.push(data[j]);
            }
            lines.push(tarr);
        }
        return lines;
    };
    var getFirstPeriodColumnIndex = function(header) {
        var colIndex = -1;
        _.each(header, function(colText, index) {
            if (!_.isEqual(colIndex, -1)) return;
            
            if ((/^\d\d\d\d-\d\d-\d\d$/).test(colText) ||
                (/^(\d+)\/(\d+)\/(\d+)$/).test(colText)
            ) {
                colIndex = index;
            }
        });
        return colIndex;
    };
    var generateResult = function(csv, lastColName) {
        var result = [];
        var header = csv[0];
        var body = csv.slice(1);
        var firstPeriodColumnIndex = getFirstPeriodColumnIndex(header);

        if (_.isEqual(firstPeriodColumnIndex, -1)) {
            addMessage("Unable to locate first period column index. Aborting.");
            return null;
        }
        addMessage("Located first period column index as: <b>" + firstPeriodColumnIndex + "</b>");
        
        // push the header row
        header = header.slice(0, firstPeriodColumnIndex);
        header = ["PERIOD"].concat(header);
        header = header.concat([lastColName]);

        // go through each body and generate accordingly
        _.each(body, function(row, rowIndex) {
            // go through each period and add the row
            for (var colIndex = firstPeriodColumnIndex; colIndex < row.length; colIndex++) {
                var period = csv[0][colIndex];
                var price = row[colIndex];
                var resultRow = row.slice(0, firstPeriodColumnIndex);

                resultRow = [period].concat(resultRow);
                resultRow = resultRow.concat([price]);
                
                result.push(resultRow);
            }
        });
        addMessage("Performing sort algorithm.. ");

        result = _.chain(result)
            .sortBy(function(resultRow) {
                // sort by date third
                return new Date(resultRow[0] + "");
            })
            .sortBy(function(resultRow) {
                // sort by product second
                return resultRow[4];
            })
            .sortBy(function(resultRow) {
                // sort by banner first
                return resultRow[3];
            })
            .value();

        result.unshift(header);

        console.log(result);

        addMessage("Successfully generated results. Dimensions: <b>" + result[0].length + " x " + result.length + "</b>");

        return result;
    };

    var makeTextFile = function(text) {
        // add the BOM header to support UTF-8 characters
        var BOM = "\uFEFF"; 
        text = BOM + text;

        // create the file blob
        var data = new Blob([text], {
            encoding: "UTF-8",
            type: "text/csv;charset=utf-8"
        });
        // create the text file
        var textFile = window.URL.createObjectURL(data);

        // returns a URL you can use as a href
        return textFile;
    };

    var makeTextFileData = function(result) {
         // fill the textarea with the copiable version of the results
        var text = "";
        _.each(result, function(row, rowIndex) {
            if (!_.isEqual(rowIndex, 0)) {
                text += "\n";
            }
            _.each(row, function(col, colIndex) {
                if (!_.isEqual(colIndex, 0)) {
                    text += ","
                }
                text += col;
            });
        });
        return text;
    };

    var saveToFile = function(fileName, result) {
        addMessage("Constructing file text. This will take a while");   
        
        setTimeout(function() {
            var text = makeTextFileData(result);

            addMessage("Making text file.");

            var blobURL = makeTextFile(text);

            fileName = "[GENERATED]_" + fileName;

            addMessage("Creating download link for blob URL: <b>" + blobURL + "</b>");

            $("<a />")
                .text("Download Results")
                .attr("download", fileName)
                .attr("href", blobURL)
                .appendTo($("#messages"));
        }, 100);
    };
    var addMessage = function(message, isHeader) {
        var $messages = $("#messages");
        if (_.isEqual($messages.find("> .message").length, 0)) {
            $messages.empty();
        }
        $("#messages").append("<div class='message " + (isHeader ? "header" : "") +"'>" + message + "</div>");
    };
});