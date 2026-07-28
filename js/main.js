;(function () {

	'use strict';



	// Animations

	var contentWayPoint = function() {
		var i = 0;
		$('.animate-box').waypoint( function( direction ) {

			if( direction === 'down' && !$(this.element).hasClass('animated') ) {

				i++;

				$(this.element).addClass('item-animate');
				setTimeout(function(){

					$('body .animate-box.item-animate').each(function(k){
						var el = $(this);
						setTimeout( function () {
							// Cards get the scan reveal; headings and section titles fade in from the left.
							var isCard = el.hasClass('col-padding') || el.data('animate-effect') === 'digitalScan';

							el.addClass(isCard ? 'digitalScan animated' : 'fadeInLeft animated');
							el.removeClass('item-animate');
						},  k * 50 );
					});

				}, 100);

			}

		} , { offset: '85%' } );
	};


	var burgerMenu = function() {

		$('.js-fh5co-nav-toggle').on('click', function(event){
			event.preventDefault();
			var $this = $(this);

			if ($('body').hasClass('offcanvas')) {
				$this.removeClass('active');
				$('body').removeClass('offcanvas');
			} else {
				$this.addClass('active');
				$('body').addClass('offcanvas');
			}
		});



	};

	// Click outside of offcanvass
	var mobileMenuOutsideClick = function() {

		$(document).click(function (e) {
		var container = $("#fh5co-aside, .js-fh5co-nav-toggle");
		if (!container.is(e.target) && container.has(e.target).length === 0) {

			if ( $('body').hasClass('offcanvas') ) {

				$('body').removeClass('offcanvas');
				$('.js-fh5co-nav-toggle').removeClass('active');

			}

		}
		});

		$(window).scroll(function(){
			if ( $('body').hasClass('offcanvas') ) {

				$('body').removeClass('offcanvas');
				$('.js-fh5co-nav-toggle').removeClass('active');

			}
		});

	};

	// FlexSlider is loaded by index.html alone (see its `extra_js`), so everywhere
	// else this is a no-op.
	var sliderMain = function() {

		if ( !$.fn.flexslider ) { return; }

		$('#fh5co-hero .flexslider').flexslider({
			animation: "fade",
			slideshowSpeed: 5000,
			start: function(){
				setTimeout(function(){
					$('.slider-text').removeClass('animated fadeInUp');
					$('.flex-active-slide').find('.slider-text').addClass('animated fadeInUp');
				}, 500);
			},
			before: function(){
				setTimeout(function(){
					$('.slider-text').removeClass('animated fadeInUp');
					$('.flex-active-slide').find('.slider-text').addClass('animated fadeInUp');
				}, 500);
			}

		});

	};

	// Document on load.
	$(function(){
		// Hide card grids as soon as the DOM is ready, then start their
		// entrance only after artwork and styles have finished loading.
		$('body').addClass('motion-enabled');
		$(window).on('load', contentWayPoint);

		burgerMenu();
		mobileMenuOutsideClick();
		sliderMain();
	});


}());
