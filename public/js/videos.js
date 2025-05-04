document.addEventListener("DOMContentLoaded", function() {
    var videos = document.querySelectorAll('.video');
  
    videos.forEach(function(video) {
      var videoID = video.getAttribute('data-id');
      var iframe = document.createElement('iframe');
      
      iframe.setAttribute('src', 'https://www.youtube.com/embed/' + videoID + '?autoplay=1&mute=0&controls=1&modestbranding=1');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
  
      video.appendChild(iframe);
    });
  });