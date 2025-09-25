
// Event listener - triggers when HTML file is finished loading
document.addEventListener('DOMContentLoaded', () => {

    const grid = document.querySelector('.grid') // selects the grid class from index.html
    let squares = Array.from(document.querySelectorAll('.grid div')) // creates array from grid elements 
    const gridSpacing = 10
    const scoreDisplay = document.querySelector('#score')
    const startButton = document.querySelector('#start-button')

    console.log(squares)
})
