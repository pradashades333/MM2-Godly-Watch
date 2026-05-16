const imageMappings = require("../config/imageMappings");

function getImageForItem(item) {
  const imagePath = imageMappings[item?.id];
  return imagePath ?? null;
}

module.exports = {
  getImageForItem
};
