/*
 *    main.js
 *    Mastering Data Visualization with D3.js
 *    Project 3 - CoinStats
 */

const MARGIN = { LEFT: 100, RIGHT: 10, TOP: 50, BOTTOM: 100 };
const WIDTH = 800 - MARGIN.LEFT - MARGIN.RIGHT;
const HEIGHT = 500 - MARGIN.TOP - MARGIN.BOTTOM;

const svg = d3
	.select('#chart-area')
	.append('svg')
	.attr('width', WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
	.attr('height', HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

const g = svg
	.append('g')
	.attr('transform', `translate(${MARGIN.LEFT}, ${MARGIN.TOP})`);

// time parser for x-scale
const parseTime = d3.timeParse('%d/%m/%Y');
// year parser for x axis
const parseYear = d3.timeParse('%Y');

// time formatter for slider info
const formatTime = d3.timeFormat('%d/%m/%Y');

// for tooltip
const bisectDate = d3.bisector((d) => d.date).left;

// scales
const x = d3.scaleTime().range([0, WIDTH]);
const y = d3.scaleLinear().range([HEIGHT, 0]);

// axis generators
const xAxisCall = d3
	.axisBottom()
	.tickValues([
		parseYear('2014'),
		parseYear('2015'),
		parseYear('2016'),
		parseYear('2017'),
	])
	.tickFormat(d3.timeFormat('%Y'));

const formatSi = d3.format('.2s');
function formatAbbreviation(x) {
	const s = formatSi(x);
	switch (s[s.length - 1]) {
		case 'G':
			return s.slice(0, -1) + 'B';
		case 'k':
			return s.slice(0, -1) + 'K';
	}
	return s;
}

const yAxisCall = d3
	.axisLeft()
	.ticks(6)
	.tickFormat((d) => formatAbbreviation(d));

// axis groups
const xAxis = g
	.append('g')
	.attr('class', 'x axis')
	.attr('transform', `translate(0, ${HEIGHT})`);
const yAxis = g.append('g').attr('class', 'y axis');

// line path generator
const line = d3.line().x((d) => x(d.date));
const lineGroup = g
	.append('path')
	.attr('class', 'line')
	.attr('fill', 'none')
	.attr('stroke', 'grey')
	.attr('stroke-width', '3px');

// labels
const xAxisLabel = g
	.append('text')
	.attr('class', 'x axis label')
	.attr('x', WIDTH / 2)
	.attr('y', HEIGHT + 40)
	.attr('text-anchor', 'middle')
	.style('font-size', '15px')
	.text('Time');

const yAxisLabel = g
	.append('text')
	.attr('class', 'y axis label')
	.attr('transform', 'rotate(-90)')
	.attr('x', -(HEIGHT / 2))
	.attr('y', -(MARGIN.LEFT - 60))
	.attr('text-anchor', 'middle')
	.style('font-size', '15px');

let formattedData;
let minActiveRange;
let maxActiveRange;

d3.json('data/coins.json').then((data) => {
	// clean data
	formattedData = data;
	Object.keys(data).forEach((coin) => {
		formattedData[coin] = formattedData[coin]
			.filter(
				(d) => d.price_usd && d.date && d['24h_vol'] && d.market_cap
			)
			.map((d) => {
				d.date = parseTime(d.date);
				d.price_usd = Number(d.price_usd);
				d.market_cap = +d.market_cap;
				d['24h_vol'] = +d['24h_vol'];
				return d;
			});
	});

	minActiveRange = d3.min(formattedData['bitcoin'], (d) => d.date).getTime();
	maxActiveRange = d3.max(formattedData['bitcoin'], (d) => d.date).getTime();

	yAxisLabel.text('Price');

	update();

	/******************************** Tooltip Code ********************************/
});

$('#coin-select').on('change', () => update());

$('#var-select').on('change', (event) => {
	console.log(event.value);
	yAxisLabel.text(() => {
		switch ($('#var-select').val()) {
			case '24h_vol':
				return '24 Hour Volume';
			case 'market_cap':
				return 'Market Capitalization';
			case 'price_usd':
				return 'Price';
		}
	});
	update();
});

$('#date-slider').slider({
	min: parseTime('12/05/2013').getTime(),
	max: parseTime('31/10/2017').getTime(),
	range: true,
	step: 86400000,
	slide: (event, ui) => {
		minActiveRange = ui.values[0];
		maxActiveRange = ui.values[1];
		update();
	},
});

const update = () => {
	const transition = d3.transition().duration(500);
	const yAxisField = $('#var-select').val();

	// get the data for the selected coin
	const data = formattedData[$('#coin-select').val()].filter(
		(d) =>
			d.date.getTime() >= minActiveRange &&
			d.date.getTime() <= maxActiveRange
	);

	// set scale domains
	x.domain([minActiveRange, maxActiveRange]);
	y.domain([0, d3.max(data, (d) => d[yAxisField])]);

	$('#date-slider').slider('values', [minActiveRange, maxActiveRange]);

	// generate axes once scales have been set
	xAxis.transition(transition).call(xAxisCall.scale(x));
	yAxis.transition(transition).call(yAxisCall.scale(y));

	// set var for line y coord from selected var
	line.y((d) => y(d[yAxisField]));

	// add line to chart
	lineGroup.transition(transition).attr('d', line(data));

	/******************************** Tooltip Code ********************************/

	const focus = g.append('g').attr('class', 'focus').style('display', 'none');

	focus
		.append('line')
		.attr('class', 'x-hover-line hover-line')
		.attr('y1', 0)
		.attr('y2', HEIGHT);

	focus
		.append('line')
		.attr('class', 'y-hover-line hover-line')
		.attr('x1', 0)
		.attr('x2', WIDTH);

	focus.append('circle').attr('r', 7.5);

	focus.append('text').attr('x', 15).attr('dy', '.31em');

	g.append('rect')
		.attr('class', 'overlay')
		.attr('width', WIDTH)
		.attr('height', HEIGHT)
		.on('mouseover', () => focus.style('display', null))
		.on('mouseout', () => focus.style('display', 'none'))
		.on('mousemove', mousemove);

	function mousemove() {
		const x0 = x.invert(d3.mouse(this)[0]);
		const i = bisectDate(data, x0, 1);
		const d0 = data[i - 1];
		const d1 = data[i];
		let d;
		if (!d0 && !d1) {
			return;
		} else if (!d0) {
			d = d1;
		} else if (!d1) {
			d = d0;
		} else {
			d = x0 - d0.date > d1.date - x0 ? d1 : d0;
		}

		focus.attr('transform', `translate(${x(d.date)}, ${y(d[yAxisField])})`);
		focus.select('text').text(formatAbbreviation(d[yAxisField]));
		focus.select('.x-hover-line').attr('y2', HEIGHT - y(d[yAxisField]));
		focus.select('.y-hover-line').attr('x2', -x(d.date));
	}

	$('#dateLabel1')[0].innerHTML = formatTime(minActiveRange);

	$('#dateLabel2')[0].innerHTML = formatTime(maxActiveRange);
};
