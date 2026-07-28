(function () {
  "use strict";

  var projects = document.getElementById("projects");

  if (
    !projects ||
    !window.CSS ||
    !window.CSS.supports("filter", "url('#project-crt-barrel')")
  ) {
    return;
  }

  var svgNamespace = "http://www.w3.org/2000/svg";
  var xlinkNamespace = "http://www.w3.org/1999/xlink";
  var svg = document.createElementNS(svgNamespace, "svg");
  var definitions = document.createElementNS(svgNamespace, "defs");
  var filter = document.createElementNS(svgNamespace, "filter");
  var mapImage = document.createElementNS(svgNamespace, "feImage");
  var displacement = document.createElementNS(svgNamespace, "feDisplacementMap");
  var mapSize = 256;
  var canvas = document.createElement("canvas");
  var context;
  var pixels;
  var x;
  var y;

  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";

  filter.setAttribute("id", "project-crt-barrel");
  filter.setAttribute("x", "-8%");
  filter.setAttribute("y", "-8%");
  filter.setAttribute("width", "116%");
  filter.setAttribute("height", "116%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  mapImage.setAttribute("result", "barrel-map");
  mapImage.setAttribute("preserveAspectRatio", "none");

  displacement.setAttribute("in", "SourceGraphic");
  displacement.setAttribute("in2", "barrel-map");
  displacement.setAttribute("scale", "48");
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");

  filter.appendChild(mapImage);
  filter.appendChild(displacement);
  definitions.appendChild(filter);
  svg.appendChild(definitions);
  document.body.appendChild(svg);

  canvas.width = mapSize;
  canvas.height = mapSize;
  context = canvas.getContext("2d");

  if (!context) {
    svg.remove();
    return;
  }

  pixels = context.createImageData(mapSize, mapSize);

  for (y = 0; y < mapSize; y += 1) {
    for (x = 0; x < mapSize; x += 1) {
      var normalizedX = (x / (mapSize - 1)) * 2 - 1;
      var normalizedY = (y / (mapSize - 1)) * 2 - 1;
      var radiusSquared =
        normalizedX * normalizedX + normalizedY * normalizedY;
      var horizontalOffset = normalizedX * radiusSquared * 0.5;
      var verticalOffset = normalizedY * radiusSquared * 0.5;
      var pixelIndex = (y * mapSize + x) * 4;

      pixels.data[pixelIndex] = Math.max(
        0,
        Math.min(255, 128 + horizontalOffset * 127)
      );
      pixels.data[pixelIndex + 1] = Math.max(
        0,
        Math.min(255, 128 + verticalOffset * 127)
      );
      pixels.data[pixelIndex + 2] = 128;
      pixels.data[pixelIndex + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);

  var mapUrl = canvas.toDataURL("image/png");
  mapImage.setAttribute("href", mapUrl);
  mapImage.setAttributeNS(xlinkNamespace, "xlink:href", mapUrl);
  projects.classList.add("has-crt-barrel");
})();
