
// Event listener - triggers when HTML file is finished loading
document.addEventListener('DOMContentLoaded', () => {

    const grid = document.querySelector('.grid') // selects the grid class from index.html
    let squares = Array.from(document.querySelectorAll('.grid div')) //  array from grid elements 
    const gridSpacing = 10
    const scoreDisplay = document.querySelector('#score')
    const startButton = document.querySelector('#start-button')

    console.log(squares)
})

//-------------------------------------------------------------------------------------------------

// dictionary for color picking in randomPieceColorIndex()
const CellColorIndex = Object.freeze({BLACK: 0, RED: 1, GREEN: 2, BLUE: 3, YELLOW: 4, WHITE: 5, TRANSPARENT: 6})
const CellColorTable = ["#000000", "#C00000", "#00C000", "#0000C0", "#C0C000", "#FFFFFF", "#000000"];

// linear interpolation to find random spot between min and max values
function linearInterp(a, b, t) { return a + t * (b - a); };
function randomInt(min, max) { return Math.round(linearInterp(min, max, Math.random())); }

// generates a color index for the randomly selected piece color
function randomPieceColorIndex() {
    const rand = Math.random(); // is there a use for this later?
    const minIndex = CellColorIndex.BLACK + 1; // colors are between the black and white indexes
    const maxIndex = CellColorIndex.WHITE -1; 
    return randomInt(minIndex, maxIndex);
}

//------------------------------------------------------------------------------------------------- 

// creates a point given x and y coordinates, with some helper functions
class Point {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    round() {
        return new Point(Math.round(this.x), Math.round(this.y));
    }
    add(pt) {
        return new Point(this.x + pt.x, this.y + pt.y);
    }
    sub(pt) {
        return new Point(this.x - pt.x, this.y - pt.y);
    }
}

//-------------------------------------------------------------------------------------------------

// this class enables us to have dynamic rectangle views of the griod
class Rect {

    //constructs a rect given edge locations
    constructor(l, t, r, b) {
        this.left = l; // x-coordinate of left edge
        this.top = t; // y-coordinate of top edge
        this.right = r; // x-coordinate of right edge
        this.bottom = b; // y-coordinate of bottom edge
    }

    toString() {
        return "[" + this.left + " " + this.top + " " + this.right + " " + this.bottom + "]";
    }

    // allows for us to return an empty ("zero-area") rect later
    static makeEmpty() {
        return new Rect(0, 0, 0, 0);
    }

    // returns a cloned copy of the given rect
    clone() {
        return new Rect(this.left, this.top, this.right, this.bottom);
    }

    // detects a zero-area or rect with negative edge lengths
    // origin (0,0) exists at grid's top-left position with all non-negative x, y
    empty() {
        return (this.left >= this.right || this.top >= bottom);
    }
    
    // ----------- GEOMETRY HELPER FUNCTIONS -----------
    width() {
        return this.right - this.left;
    }
    height() {
        return this.bottom - this.top; 
    }
    center() {
        return new Point((this.left + this.right)/2, (this.top + this.bottom)/2);
    }

    // ------------- SET RELATIONS FUNCTIONS --------------
    
    // returns true if r is in this rect
    contains(r) {

        if (this.empty() || r.empty()) return false;

        return (this.left <= r.left && this.top <= r.top && this.right >= r.right
            && this.bottom  >= r.bottom); 

    }

    // returns new rect that is the rect that contains the union of rect and r - including unoccupied areas
    union(r) {

        if (this.empty()) return r.clone(); // union with empty set is equal to the non-empty set, regardless empty rect location
        if (r.empty()) return this.clone();

        return new Rect(Math.min(this.left, r.left), Math.min(this.top, r.top), 
                        Math.max(this.right, r.right), Math.max(this.bottom, r.bottom));
    }

    // returns new rect that is the intersecion of rect and r 
    intersection(r) {

        if (this.empty() || r.empty()) return Rect.makeEmpty();

        return new Rect(Math.max(this.left, r.left), Math.max(this.top, r.top), 
                        Math.min(this.right, r.right), Math.min(this.bottom, r.bottom));

    }

    // returns true if intersection is not empty
    intersects(r) {
        return !this.intersection(r).empty()
    }

    // -------------- TRANSLATION/TRANSFORMATION -----------
    
    // performs translation given x and y increments 
    offset(x, y) {
        this.left += x; this.top +=y; this.right += x; this.bottom += y;
    }

    // performs relocation to specified location
    moveTo(x, y) {
        this.offset(x - this.left, y - this.top) 
    }



}   
