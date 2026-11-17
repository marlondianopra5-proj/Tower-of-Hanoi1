:- begin_tests(tower_of_hanoi).

:- [server].

test(initial_game_has_three_disks) :-
    new_game(3),
    game_state(3, [[1, 2, 3], [], []], 0, false).

test(legal_move_updates_pegs) :-
    new_game(3),
    apply_move(0, 2, [[1, 2, 3], [], []], [[2, 3], [], [1]]).

test(cannot_place_larger_disk_on_smaller, [throws(error(game_error(_), _))]) :-
    apply_move(0, 2, [[2, 3], [], [1]], _).

test(cannot_move_from_empty_peg, [throws(error(game_error(_), _))]) :-
    apply_move(1, 2, [[1, 2, 3], [], []], _).

test(hint_solves_initial_three_disk_game) :-
    shortest_path([[1, 2, 3], [], []], 3, Path),
    length(Path, 7),
    Path = [move(0, 2)|_].

:- end_tests(tower_of_hanoi).
