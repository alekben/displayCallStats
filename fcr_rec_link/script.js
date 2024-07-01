document.getElementById('popupButton').addEventListener('click', function() {
  alert("Current URL: " + window.location.href);
});

let urlText = document.getElementById('currentUrl');

let currentURL = window.location.href;

urlText.innerText = currentURL;
