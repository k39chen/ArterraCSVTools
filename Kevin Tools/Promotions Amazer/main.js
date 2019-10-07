$(document).ready(function() {
    var Reader = new FileReader();
    var VALUE_REQUIRED_PROMO_CODES = ["LO", "AM"];
    var LOADED_FILE_NAME = null;
    var LOADED_CSV = null;

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
    $("#continueBtn").click(function() {
        var $container = $("#codesContainer");
        var promotionCodesMap = serializeCodes(LOADED_CSV);

        // attempt to generate the result
        var result = generateResult(LOADED_CSV, promotionCodesMap);
        
        // if we failed to generate the result, then abort
        if (_.isNull(result)) return;

        // attempt to save to a file
        saveToFile(LOADED_FILE_NAME, result);
    });

    var process = function(fileData, text) {
        var csv = getCsvData(text);
        var fileName = fileData.name;

        addMessage("Successfully read file <b>" + fileName + "</b>. Dimensions: <b>" + csv[0].length + " x " + csv.length + "</b>");

        // save our loaded CSV reference
        LOADED_FILE_NAME = fileName;
        LOADED_CSV = csv;

        // render the codes so that the use can specify which codes are valid
        renderCodes(csv);
    };

    var getCsvData = function(csv) {
        var allTextLines = csv.split(/\r\n|\n/);
        var lines = [];
        for (var i=0; i<allTextLines.length; i++) {
            var data = allTextLines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
            var tarr = [];
            for (var j=0; j<data.length; j++) {
                tarr.push($.trim(data[j]));
            }
            lines.push(tarr);
        }
        return lines;
    };

    var renderCodes = function(csv) {
        var $container = $("#codesContainer");
        var $list = $("#codesList");
        var header = csv[0];
        var body = csv.slice(1);
        var promotionCodesMap = getAllPromotionCodes(header, body);
        promotionCodesMap = _.sortBy(_.toArray(promotionCodesMap), _.property("ordinal"));

        $container.show();

        _.each(promotionCodesMap, function(data) {
            var $item = $("<div class='code-item' data-code='" + data.code + "' />").html("<span>" + data.code + "</span><a class='remove-btn'>X</a>");
            $item.click(function() {
                $(this).remove();
            });
            $item.appendTo($list); 
        });
    };

    var serializeCodes = function(csv) {
        var $list = $("#codesList");
        var header = csv[0];
        var body = csv.slice(1);
        var promotionCodesMap = getAllPromotionCodes(header, body);
        var remainingCodes = [];

        $list.find("> .code-item").each(function() {
            remainingCodes.push($(this).attr("data-code"));
        });
        promotionCodesMap = _.pick(promotionCodesMap, remainingCodes);

        var promotionCodeKeys = _.keys(promotionCodesMap);
        promotionCodeKeys = _.sortBy(promotionCodeKeys, function(code) { return code; });

        // apply ordinal to assist output
        promotionCodesMap = _.each(promotionCodesMap, function(code) {
            code.ordinal = promotionCodeKeys.indexOf(code.code);
        });
        return promotionCodesMap;
    };

    var generateResult = function(csv, promotionCodesMap) {
        var result = [];
        var header = csv[0];
        var originalHeaderLength = header.length;
        var body = csv.slice(1);
        var promotionsColumnIndex = getPromotionsColumnIndex(header);
        var numTotalCodes = _.keys(promotionCodesMap).length;

        // add a new column for each promotion code
        _.each(promotionCodesMap, function(data) {
            header[originalHeaderLength + data.ordinal] = data.code;
        });
        // add this header to the result
        result.push(header);

        // go through each body and generate accordingly
        _.each(body, function(row, rowIndex) {
            var promotionCodesRaw = row[promotionsColumnIndex];
            var promotionCodes = getPromotionCodes(promotionCodesRaw);
            var subResult = [];

            // if there are no promotion codes in this cell, fill with empty values
            if (!promotionCodes) {
                subResult = fillArray(0, numTotalCodes);
            } else {
                // go through all registered promotion codes and add it to the subresult
                _.each(promotionCodesMap, function(data) {
                    var hasPromoCode = promotionCodes.indexOf(data.code) >= 0;

                    if (data.isValueColumn && promotionCodes.indexOf(data.code.replace(/_VALUE$/, "")) >= 0) {
                        var promoPrice = getPromotionPrice(promotionCodesRaw);
                        subResult[data.ordinal] = promoPrice + "";
                    } else {
                        subResult[data.ordinal] = hasPromoCode ? "1" : "0";
                    }
                });
            }
            // concatenate this sub-result to the existing row data
            var resultRow = row.concat(subResult);

            // add this row to our result
            result.push(resultRow);
        });
        addMessage("Successfully generated results. Dimensions: <b>" + result[0].length + " x " + result.length + "</b>");

        return result;
    };

    var getPromotionsColumnIndex = function(header) {
        return header.indexOf("Promotions");
    };

    var getPromotionCodes = function(promotionCodes) {
        if (!promotionCodes) return null;

        promotionCodes = JSON.parse(JSON.stringify(promotionCodes));
        promotionCodes = promotionCodes.split(" ");
        promotionCodes = _.reject(promotionCodes, function(code) {
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
        promotionCodes = _.map(promotionCodes, function(code) {
            return code.replace(/\-$/, "");
        });
        return promotionCodes || null;
    };

    var getPromotionPrice = function(values) {
        if (!values) return null;

        var price;
        var parts;
        var dollars;
        var cents;
        values = JSON.parse(JSON.stringify(values));
        values = values.split(" ");

        for (var i=0; i<values.length; i++) {
            price = parseFloat(values[i].replace(/\$/gi, ""));
            if (!_.isNaN(price)) {
                return price.toFixed(2);
            }
        }
        return null;
    };

    var getAllPromotionCodes = function(header, body) {
        var promotionsColumnIndex = getPromotionsColumnIndex(header);
        var codes = {};

        // go through each row and scrape the promotion codes
        _.each(body, function(row, rowIndex) {
            var promotionCodesRaw = row[promotionsColumnIndex];
            var promotionCodes = getPromotionCodes(promotionCodesRaw);
            _.each(promotionCodes, function(code) {
                if (_.isUndefined(codes[code])) {
                    codes[code] = { code: code, ordinal: -1, count: 0 };
                }
                codes[code].count++;

                // we have two edge cases, namely LO and AM are interested
                // in reporting pricing information so we will create
                // two columns for these
                if (VALUE_REQUIRED_PROMO_CODES.indexOf(code) >= 0) {
                    codes[code + "_VALUE"] = { code: code + "_VALUE", ordinal: -1, count: 0, isValueColumn: true };;
                }
            });
        });
        var codeKeys = _.keys(codes);
        codeKeys = _.sortBy(codeKeys, function(code) { return code; });

        // apply ordinal to assist output
        codes = _.each(codes, function(code) {
            code.ordinal = codeKeys.indexOf(code.code);
        });
        // return the codes represented as a truth map
        return codes;
    };

    var fillArray = function(value, numRepeat) {
        var arr = [];
        for (var i=0; i<numRepeat; i++) {
            arr.push(value);
        }
        return arr;
    };

    var containsLowerCase = function(str) {
        for (var i=0; i<str.length; i++) {
            if (_.isNull(str[i].match(/A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|WvX|Y|Z/i))) continue;
            if (str[i].toLowerCase() === str[i]) {
                return true;
            }
        }
        return false;
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