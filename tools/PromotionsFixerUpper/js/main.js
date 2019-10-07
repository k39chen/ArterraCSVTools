$(document).ready(function () {
  var $input = $("textarea#input");
  var $generatePromotionsBtn = $("button#generate-promotion-types-btn");
  var $generateOutputBtn = $("button#generate-output-btn");

  var $promotionTypesCount = $("#promotion-types-count");
  var $promotionTypes = $("#promotion-types");

  $promotionTypes.sortable({
    items: ".promotion-type",
    stop: function () {
      setOrdinals($(this));
    }
  });
  var SUGGESTED_ORDINALS = _.invert([
    "Circulaire-Majeur à rabais mixte",
    "Circulaire-Standard Plus 170 succursales à rabais mixte",
    "Circulaire-Standard plus 120 succursales à rabais mixte",
    "Circulaire-Standard plus 235 succursales à points bonis",
    "Circulaire-Standard plus 235 succursales à rabais mixte",
    "Circulaire-Standard plus 25 succursales à rabais mixte",
    "Circulaire-Standard plus 315 succursales sans rabais",
    "Circulaire-Standard plus 315 succursales à rabais mixte",
    "Circulaire-Standard plus 60 succursales à rabais mixte",
    "Circulaire-Standard plus 80  succursales sans rabais",
    "Circulaire-Standard plus 80  succursales à rabais mixte",
    "Circulaire-Vedette à rabais mixte",
    "Événement tactique-Forfait Nouveauté",
    "Événement tactique-Forfait Nouveauté Sélection",
    "Événement tactique-Produit à découvrir à rabais mixte",
    "Événement tactique-Standard plus 235 succursales sans rabais",
    "Événement tactique-Standard plus 235 succursales à points bonis",
    "Événement tactique-Standard plus 315 succursales sans rabais",
    "Événement tactique-Standard plus 80  succursales à points bonis",
    "Forfait offre de lancement",
    "Vitrine 1 période",
    "Dégustation - régulière",
    "Étalage super",
    "Étalage maxi",
    "Étalage régulier",
    "Étalage gros",
    "Étalage mini longue durée",
    "Étalage mini",
    "Allongeur - régulier",
    "Frigo longue durée",
    "Frigo 1 période",
    "LTO",
    "Points"
  ]);

  function getSuggestedPromotionOrdinal(promotion) {
    return SUGGESTED_ORDINALS[promotion] || -1;
  };

  function getPromotionType(promotion) {
    var promotionType = $.trim(promotion);

    // we're only interested in getting the unique promotion type
    // - the regex here removes the trailing number and dash along
    //   with remaining whitespaces
    promotionType = promotionType.replace(/(-|_)\s*[0-9,.]+$/, "");
    promotionType = $.trim(promotionType);

    return promotionType;
  };

  function getPromotionSuffix(promotion) {
    var promotionSuffix = $.trim(promotion);

    // we're only interested in getting the unique promotion type
    // - the regex here removes the trailing number and dash along
    //   with remaining whitespaces
    promotionSuffix = promotionSuffix.match(/(-|_)\s*[0-9,.]+$/);

    if (promotionSuffix && promotionSuffix.length > 0) {
      promotionSuffix = promotionSuffix[0];
      promotionSuffix = promotionSuffix.replace(/-|_/g, "");
      promotionSuffix = $.trim(promotionSuffix);
      return parseFloat(promotionSuffix);
    }
    return -1;
  };

  function setOrdinals($list) {
    $list.find(".promotion-type").each(function (index) {
      var $item = $(this);
      var $ordinal = $item.find("> .ordinal");
      $ordinal.text(index + 1);
    });
  }

  function generatePromotionTypes() {
    // try and get a list of promotion types
    var promotionTypes = [];

    // get our active input
    var rows = $input.val();
    rows = rows.split("\n");

    // go through each row and try to get the list of promotions (comma-separated)
    _.each(rows, function (row) {
      var promotions = row.split(",");
      promotions = _.each(promotions, function (promotion) {
        var promotionType = getPromotionType(promotion);
        promotionTypes.push(promotionType);
      });
    });
    // some refining of the promotion types
    promotionTypes = _.chain(promotionTypes)
      .uniq()
      .filter(function (promotion) { return !_.isEmpty(promotion); })
      .sortBy(function (promotion) { return getSuggestedPromotionOrdinal(promotion) || promotion; })
      .value();

    // update the promotion types count
    $promotionTypesCount.text("(" + promotionTypes.length + ")");

    // create the items for our sortable list (make sure its empty first)
    var itemMarkup = [];
    _.each(promotionTypes, function (promotionType) {
      itemMarkup.push("<div class='promotion-type' data-id='" + promotionType + "'><span class='ordinal'>1</span><span class='label'>" + promotionType + "</span></div>");
    });
    $promotionTypes.html(itemMarkup.join("\n"));

    setOrdinals($promotionTypes);

    $('.section[data-id="promotion-types"]').show();
  };

  function generateOutput() {
    var $output = $("textarea#output");
    var promotionTypeOrdinals = _.invert($promotionTypes.sortable("toArray", { attribute: "data-id" }));
    _.each(promotionTypeOrdinals, function(val, key) {
      promotionTypeOrdinals[key] = parseInt(val, 10);
    });
    var output = [];

    // get our active input
    var rows = $input.val();
    rows = rows.split("\n");

    // go through each row and try to get the list of promotions (comma-separated)
    _.each(rows, function (row) {
      output.push(generateSortedRow(row, promotionTypeOrdinals));
    });
    // set the output content
    $output.val(output.join("\n"));

    $('.section[data-id="output"]').show();
  };

  function generateSortedRow(row, ordinals) {
    var promotions = row.split(",");

    promotions = _.map(promotions, function (promotion) {
      return $.trim(promotion);
    });
    // group the promotions so that we can deal with duplicate types.
    // our policy here will be to take the largest numerical suffix
    var promotionsGroups = _.groupBy(promotions, function (promotion) {
      return getPromotionType(promotion);
    });
    // rebuild our promotions from the groups
    promotions = [];
    _.each(promotionsGroups, function (group, type) {
      // we have a VERY specific case for Points (exclude 0.00)
      if (_.isEqual(type, "Points")) {
        group = _.reject(group, function (promotion) {
          return _.isEqual(getPromotionSuffix(promotion), 0);
        });
      }
      // get the largest promotion in this grouping
      var largestGroupedPromotion = _.max(group, function (promotion) {
        return getPromotionSuffix(promotion);
      });
      if (!_.isEqual(largestGroupedPromotion, -Infinity)) {
        promotions.push(largestGroupedPromotion);
      }
    });
    // sort the promotions based of promotion type
    promotions = _.sortBy(promotions, function (promotion) {
      var promotionType = getPromotionType(promotion);
      var ordinal = ordinals[promotionType];
      return ordinal;
    });
    return promotions.join(", ");
  };
  $('textarea#input').change(function () {
    $('.section[data-id="promotion-types"]').hide();
    $('.section[data-id="output"]').hide();
  });

  $('#generate-promotion-types-btn').click(generatePromotionTypes);
  $('#generate-output-btn').click(generateOutput);
});
