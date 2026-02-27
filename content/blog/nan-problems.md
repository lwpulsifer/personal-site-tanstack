---
title: NaN Problems
description: "A deep dive into NaN in JavaScript and why removeItem(arr, NaN) might not be a great idea."
pubDate: '2024-01-07'
author: Liam Pulsifer
tags: programming,software,javascript,bugs
display: true
---

Heya, and welcome to a needlessly in-depth discussion of an inconsequential bug!
I had an interesting discussion and subsequent bug hunt with a coworker the other day.
They're new to Javascript and while working on some new application code, they ran into
a utility function that I had written a while back looking something like this:

```js
function removeItem(arr, item) {
  const itemIndex = arr.indexOf(item);

  if (itemIndex > -1) {
    arr.splice(itemIndex, 1);
  }
  return arr;
}
```

It's a pretty simple function that takes in an array and removes the passed-in item from it, if it's present, then returns the modified array.
I wrote it mainly to avoid having to write the `indexOf/splice` combo over and over again, but it does the trick nicely and allows me to avoid
the most annoying feature of `Array.prototype.splice`, that it returns the removed elements rather than the modified array.

My coworker noticed a potential issue with this function, though. It doesn't work with `NaN`, Javascript's representation of the non-number result
of a numeric calculation—that is, an expression like `1 + 'a'`. When you call `removeItem` with `NaN` as the item to be removed,
nothing happens, even when `NaN` is in the array.

```js
const myArray = [1, 2, 3, NaN, 5];
removeItem(myArray, NaN);

myArray; // [1, 2, 3, NaN, 5], where my coworker expected it to be [1, 2, 3, 5]
```

The reason for this is simple, at least initially. [indexOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf)
doesn't work with `NaN`. That's because `indexOf` uses strict equality to determine if an element is contained in an array, and
`NaN === NaN` always evaluates to `false` (we'll get to exactly why that is later). In my coworker's mind, this indicated a bug,
as `NaN` can be an element of arrays, but `removeItem` didn't work for it.

Astute readers will already have noticed that I've skimmed over a couple of important questions that we really need to answer before we can decide if
this behavior is truly a bug or not, namely stuff like

- What kind of "items" do we expect to be able to remove from arrays with this function?
- What does it mean for an item to be _in_ an array?

but for the sake of telling this story in the same fashion it came to me, let's put a pin in those and come back to them a little later.

## The "Fix"

I wasn't included on the initial discussions about this issue, and I ended up getting looped in when I saw what my coworker had decided to do to
fix the issue for their use case. In fact, that fix had caused a production bug, and it looked something like this:

```js
function removeItem(arr, item) {
  let itemIndex = -1;

  // In the not NaN case, indexOf should work as expected
  if (!isNaN(item)) {
    itemIndex = arr.indexOf();
  }

  // In the NaN case, we have to manually search
  else {
    for (let i = 0; i < arr.length; i++) {
      if (isNaN(arr[i])) {
        itemIndex = i;
        break;
      }
    }
  }

  if (itemIndex > -1) {
    arr.splice(itemIndex, 1);
  }
  return arr;
}
```

Seems reasonable enough. We have easy access to an [`isNaN`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN)
function on the `window` object, so we add a special case for when the item to
be removed is `NaN` and do a direct iterative approach to searching for that element as `indexOf` won't work. Unfortunately, it's not quite so simple.
`window.isNaN` always returns `true` when the item passed to it is not of `Number` type. So other non-numerics in the array will break things:

```js
const maybeNums = [1, 2, 3, Nan, 5];

removeItem(maybeNums, NaN); // Works fine for arrays with just numbers or `NaN`
maybeNums; // [1, 2, 3, 5]

const mixedArray = [1, {}, "hello", NaN, 5]; // But breaks here
removeItem(mixedArray, NaN); // [1, 'hello', NaN, 5]
```

Do you see why? In the `else` branch above, we iterate until `isNan(arr[i]) === true`, but it always evaluates to `true` for non-numbers, so we
remove the empty object instead of the "number NaN" because the object appears first in the array.

## Fixing the Fix

When I first pointed this out to my coworker, they were quick to come back with a potential fix: just replace calls to `isNaN` with a similar
function, `Number.isNaN`—also a JS built-in. That function is identical to `isNaN` but returns `false` rather than `true` when its argument doesn't have the number type.

```js
isNaN(NaN); // true
Number.isNaN(NaN); // true

isNaN(4); // false
Number.isNaN(4); // false

isNaN("s"); // true
Number.isNaN("s"); // false

isNaN({}); // true
Number.isNaN({}); // false
```

Initially, I thought ok, that does seem to fix the issue and give my coworker the behavior they were looking for. The more I thought about it,
though, the more I came back to whether having `removeItem(arr, NaN)` work that way is actually a good thing.

### Why NaN?

As I understand it, `NaN` is a dynamically-typed language's way of adding some "type safety" to numeric calculations, which are often critical
parts of an application, without necessarily throwing exceptions and potentially breaking the application.
If you have some complex chain of mathematical logic that has a bug somewhere, you want to know about it
as soon as possible. But in a permissive, dynamic language like Javascript that will try its best to make things work, an `undefined` somewhere
could result in your math being silently wrong! `NaN` helps prevent that by "bubbling up" through calculations so that you can see just by
reviewing the result of a calculation that it has some kind of typing issue. Take the following example:

```js
// A list of sale receipt objects (ignore the obvious data modeling issues here!)
const saleReceipts = [
	{
		itemName: 'Stuffed Animal (Tiger)',
		itemPrice: 14.99,
		quantitySold: 5,
		itemDiscountApplied: 1.50,
		saleDate: 'Jan 3, 2024',
	},
	...
];

// Attempts to calculate the total price of a sale by subtracting
// any discounts from the purchase price.
function calculateTotalPrice(saleReceipt) {
	const totalSale = saleReceipt.itemPrice * saleReceipt.quantitySold;

	// Bug, we made a typo by referencing the `quantity` property rather than `quantitySold`
	// saleReceipt.quantity is undefined, so totalDiscount is NaN
	const totalDiscount = saleReceipt.itemDiscountApplied * saleReceipt.quantity;
	return totalSale - totalDiscount;
}

const totalSales = sum(saleReceipts.map(calculateTotalPrice));
totalSales // NaN
```

Because `totalSales` is `NaN`, we can tell immediately that there's some issue with our calculations. We can then
break down the computation into its constituent parts and find the one returning `NaN` originally, which will help us
find our bug.

Crucially, a major piece of this process working is that `NaN === NaN` is defined to be `false`. The reason for that
is that many different operations can create `NaN` values, so any two `NaN`s could have been created in totally different ways.

```js
const x = 1 + "a";
const y = 10 / 0;

x === y; // false, clearly!
```

So `NaN` is a value in Javascript, but it's not a _distinct_ value—it's more like a category of things (and I use that word non-rigorously).
With that in mind, is it appropriate to be able to "successfully" call `removeItem(arr, NaN)`? I don't think it is.
Removing an "item" doesn't really mean anything when that item doesn't have a specific
identity. How would we know whether the `NaN` we're removing is the same `NaN` we're passing in to be removed?

## Fixing the fixed fix

At this point, I thought of a different angle from which to approach the question. Can we [remove the problem](https://kentcdodds.com/blog/don-t-solve-problems-eliminate-them)
rather than solving it? This is an approach I love from [Kent C. Dodds](https://kentcdodds.com/about). So I finally got around to looking back at
where `removeItem` was actually being used, and saw that we could quite easily replace the existing usages like so:

An example of the old version:

```js
// Due to the way this particular interface was working, exactly 1 of these field values could be NaN,
// while the rest were guaranteed to be of Number type.
const fieldValues = computeFieldValues();
const fieldValuesWithoutNaN = removeItem(fieldValues, NaN);
```

The new version:

```js
const fieldValues = computeFieldValues();
const fieldValuesWithoutNaN = fieldValues.filter((val) => !isNaN(val));
```

Sure, it might technically be a little redundant to remove _any_ `NaN` value from the list when we know there's at most 1, but it's
simple, clear, and doesn't require making a major update to the contract of a utility function that has a bunch of other usages.

So after much ado, the sum total of the changeset here became:

- An update to the documentation of `removeItem` warning people not to expect it to work on `NaN`
- Replacing existing calls to it using `NaN` with a more specific approach that removes `NaN` and nothing else.

## My takeaways?

- Avoid the temptation to make utility functions handle each and every potential edge case.
  - Often it's simpler and more maintainable to make a targeted function that does exactly what you want.
- When debugging, it can be better in the long run to ask "Do I really need to do this?" rather than "How do I do this?".
- When a built-in JS function has a strange edge case, it's worth digging in to figure out _why_.
- Our frontend utility functions should definitely have better unit tests :P.

What do you think?
