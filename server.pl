:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_files)).
:- use_module(library(http/http_json)).
:- use_module(library(http/thread_httpd)).
:- use_module(library(lists)).

:- dynamic game_state/4.

:- http_handler(root(api/state), api_state, []).
:- http_handler(root(api/new), api_new_game, []).
:- http_handler(root(api/move), api_move, []).
:- http_handler(root(api/hint), api_hint, []).
:- http_handler(root(.), http_reply_from_files('public', [indexes(['index.html'])]), [prefix]).

:- initialization(initialize_game).
:- initialization(main, main).

main :-
    start_server(8080).

start_server(Port) :-
    http_server(http_dispatch, [port(Port)]),
    format('Tower of Hanoi is running at http://localhost:~d/~n', [Port]),
    thread_get_message(stop).

initialize_game :-
    new_game(3).

new_game(Count) :-
    validate_disk_count(Count),
    with_mutex(tower_game, reset_game(Count)).

api_state(_Request) :-
    with_mutex(tower_game, state_response(Response)),
    reply_json_dict(Response).

api_new_game(Request) :-
    handle_api_request(Request, new_game_request).

new_game_request(Data, Response) :-
    required_integer(Data, disks, Count),
    validate_disk_count(Count),
    with_mutex(tower_game,
        ( reset_game(Count),
          state_response(Response)
        )).

validate_disk_count(Count) :-
    (   integer(Count),
        between(3, 8, Count)
    ->  true
    ;   throw(error(game_error("Choose between 3 and 8 disks."), _))
    ).

reset_game(Count) :-
    numlist(1, Count, Disks),
    retractall(game_state(_, _, _, _)),
    assertz(game_state(Count, [Disks, [], []], 0, false)).

api_move(Request) :-
    handle_api_request(Request, move_request).

move_request(Data, Response) :-
    required_integer(Data, from, From),
    required_integer(Data, to, To),
    with_mutex(tower_game,
        ( game_state(Count, Pegs, Moves, Won),
          apply_move(From, To, Pegs, UpdatedPegs),
          NextMoves is Moves + 1,
          ( nth0(2, UpdatedPegs, GoalPeg),
            length(GoalPeg, Count)
          -> NextWon = true
          ;  NextWon = false
          ),
          retractall(game_state(_, _, _, _)),
          assertz(game_state(Count, UpdatedPegs, NextMoves, NextWon)),
          state_response(Response)
        )).

api_hint(_Request) :-
    catch(
        ( with_mutex(tower_game,
            ( game_state(Count, Pegs, _, Won),
              ( Won == true
              -> throw(error(game_error("The puzzle is already solved."), _))
              ;  shortest_path(Pegs, Count, Path),
                 Path = [move(From, To)|_],
                 Hint = _{from: From, to: To}
              )
            )),
          reply_json_dict(Hint)
        ),
        error(game_error(Message), _),
        reply_json_dict(_{error: Message}, [status(400)])
    ).

handle_api_request(Request, Goal) :-
    catch(
        ( http_read_json_dict(Request, Data),
          call(Goal, Data, Response),
          reply_json_dict(Response)
        ),
        error(game_error(Message), _),
        reply_json_dict(_{error: Message}, [status(400)])
    ).

required_integer(Data, Key, Value) :-
    (   get_dict(Key, Data, Value),
        integer(Value)
    ->  true
    ;   throw(error(game_error("Request is missing a valid number."), _))
    ).

apply_move(From, To, Pegs, UpdatedPegs) :-
    (   between(0, 2, From),
        between(0, 2, To),
        From =\= To,
        nth0(From, Pegs, [Disk|SourceRest]),
        nth0(To, Pegs, Destination),
        ( Destination = []
        ; Destination = [Top|_],
          Disk < Top
        )
    ->  replace_nth0(From, Pegs, SourceRest, WithoutDisk),
        replace_nth0(To, WithoutDisk, [Disk|Destination], UpdatedPegs)
    ;   throw(error(game_error("That move is not allowed. Select a top disk and place it on a larger disk or an empty peg."), _))
    ).

replace_nth0(Index, List, Value, Updated) :-
    nth0(Index, List, _, Rest),
    nth0(Index, Updated, Value, Rest).

state_response(_{
    disks: Count,
    moves: Moves,
    minimum: Minimum,
    won: Won,
    pegs: PegSnapshots
}) :-
    game_state(Count, Pegs, Moves, Won),
    Minimum is (1 << Count) - 1,
    maplist(peg_snapshot, [0, 1, 2], Pegs, PegSnapshots).

peg_snapshot(Index, Disks, _{id: Index, disks: Disks}).

shortest_path(Pegs, Count, Path) :-
    numlist(1, Count, Disks),
    Goal = [[], [], Disks],
    breadth_first([[Pegs, []]], [Pegs], Goal, ReversedPath),
    reverse(ReversedPath, Path).

breadth_first([[Goal, Path]|_], _, Goal, Path) :-
    !.
breadth_first([[Current, Path]|Queue], Visited, Goal, Result) :-
    findall(
        [Next, [move(From, To)|Path]],
        ( legal_successor(Current, Next, From, To),
          \+ memberchk(Next, Visited)
        ),
        Candidates
    ),
    candidate_states(Candidates, NewStates),
    append(Visited, NewStates, UpdatedVisited),
    append(Queue, Candidates, UpdatedQueue),
    breadth_first(UpdatedQueue, UpdatedVisited, Goal, Result).

candidate_states([], []).
candidate_states([[State, _]|Candidates], [State|States]) :-
    candidate_states(Candidates, States).

legal_successor(Pegs, UpdatedPegs, From, To) :-
    between(0, 2, From),
    between(0, 2, To),
    From =\= To,
    nth0(From, Pegs, [Disk|SourceRest]),
    nth0(To, Pegs, Destination),
    (   Destination = []
    ;   Destination = [Top|_],
        Disk < Top
    ),
    replace_nth0(From, Pegs, SourceRest, WithoutDisk),
    replace_nth0(To, WithoutDisk, [Disk|Destination], UpdatedPegs).
