# `@ove-lib/filter`

> Library for [Open Visualization Environment (OVE)](https://github.com/ove/ove) framework that provides functions to filter arrays of data.

This allows all OVE applications to filter data (or to interpret a specification for highlightinh) in a consistent way.

It exposes two methods: one accepts a query as a string, and parses this into a syntax tree; the second accepts this tree and returns a predicate function that evaluates whether an object matches the query.
The intermediate syntax tree has a structure similar to that produced by [odata-parser](https://www.npmjs.com/package/odata-v4-parser).


## Query language

The query language corresponds to a subset of the [OData Filter System Query Option](https://www.odata.org/documentation/odata-version-2-0/uri-conventions/).

However, the implementation currently has the following limitations:

* the type functions `IsOf(type p0)` and ` IsOf(expression p0, type p1)` are not implemented
* none of the date functions are implemented


## Usage

### As a node package

This module can be installed with npm:

```bash
npm install @ove-lib/filter --save
```

It can then be included with `require`:

```javascript

const getPredicate = require('@ove-lib/filter/filter').getPredicate;
const parse = require('@ove-lib/filter/parser').parse;

const queryString = parse('age gt 21');
const predicate = getPredicate(queryString);

let people = [{name: 'Bob', age: 25}, {name: 'Sam', age: 18}];

predicate({name: 'Bob', age: 25}); // True
predicate({name: 'Sam', age: 18}); // False

// Can use with Array.prototype.filter()
people.filter(predicate); // [{name: 'Bob', age: 25}]
```


### On the front-end, in a browser

To use the filtering functions within a web browser, first include the single file `dist/filter.all.min.js`, and then use the methods `Filter.parse()` and `Filter.getPredicate()`:

```HTML

<script = 'path/to/filter.all.min.js />'

<script>
const queryString = Filter.parse('age gt 21');
const predicate = Filter.getPredicate(queryString);

let people = [{name: 'Bob', age: 25}, {name: 'Sam', age: 18}];

predicate({name: 'Bob', age: 25}); // True
predicate({name: 'Sam', age: 18}); // False

// Can use with Array.prototype.filter()
people.filter(predicate); // [{name: 'Bob', age: 25}]

</script>

```
